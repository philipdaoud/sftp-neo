import upath from './upath';
import { promptForPassword, showConfirmMessage, showWarningMessage } from '../host';
import logger from '../logger';
import app from '../app';
import { ConnectOption } from './remote-client/remoteClient';
import { storeCredential } from '../modules/secrets';
import { checkHostKey } from './remote-client/hostKeyStore';
import { setConnectionState, removeConnection } from '../modules/connectionHealth';
import {
  FileSystem,
  RemoteFileSystem,
  SFTPFileSystem,
  FTPFileSystem,
} from './fs';
import localFs from './localFs';

function hashOption(opiton) {
  return Object.keys(opiton)
    .map(key => opiton[key])
    .join('');
}

class KeepAliveRemoteFs {
  private isValid: boolean = false;

  private pendingPromise: Promise<RemoteFileSystem> | null;

  private fs: RemoteFileSystem;

  private _identity: string;

  setIdentity(identity: string) {
    this._identity = identity;
  }

  async getFs(
    option: ConnectOption & {
      protocol: string;
      remoteTimeOffsetInHours: number;
    }
  ): Promise<RemoteFileSystem> {
    if (this.isValid && this.fs && this.fs.getClient().isClosed()) {
      logger.debug('Cached remote connection is closed; reconnecting.');
      this.invalid('closed');
    }

    if (this.isValid) {
      this.pendingPromise = null;
      return Promise.resolve(this.fs);
    }

    if (this.pendingPromise) {
      return this.pendingPromise;
    }

    setConnectionState(this._identity, option.host, option.protocol, 'connecting');

    const connectOption = Object.assign({}, option);
    // tslint:disable variable-name
    let FsConstructor: typeof SFTPFileSystem | typeof FTPFileSystem;
    if (option.protocol === 'sftp') {
      connectOption.debug = function debug(str) {
        const log = str.match(/^DEBUG(?:\[SFTP\])?: (.*?): (.*?)$/);

        if (log) {
          if (log[1] === 'Parser') return;
          logger.debug(`${log[1]}: ${log[2]}`);
        } else {
          logger.debug(str);
        }
      };
      FsConstructor = SFTPFileSystem;
    } else if (option.protocol === 'ftp') {
      connectOption.debug = function debug(str) {
        const log = str.match(/^\[connection\] (>|<) (.*?)(\\r\\n)?$/);

        if (!log) return;

        if (log[2].match(/200 NOOP/)) return;

        if (log[2].match(/^PASS /)) log[2] = 'PASS ******';

        logger.debug(`${log[1]} ${log[2]}`);
      };
      FsConstructor = FTPFileSystem;
    } else {
      throw new Error(`unsupported protocol ${option.protocol}`);
    }

    this.fs = new FsConstructor(upath, {
      clientOption: connectOption,
      remoteTimeOffsetInHours: option.remoteTimeOffsetInHours,
    });
    this.fs.onDisconnected(this.invalid.bind(this));

    const askForPasswd = async (msg: string): Promise<string | undefined> => {
      const value = await promptForPassword(msg);
      if (value !== undefined && connectOption.username) {
        const save = await showConfirmMessage(
          `Save password for ${connectOption.username}@${connectOption.host} to Secret Storage?`,
          'Save',
          'Don\'t Save'
        );
        if (save) {
          await storeCredential(connectOption.host, connectOption.username, 'password', value);
        }
      }
      return value;
    };

    const verifyHostKey = async (fp: string, host: string, port: number): Promise<boolean> => {
      return checkHostKey(host, port, fp, async (fingerprint, h) => {
        const accepted = await showConfirmMessage(
          `The SSH host key for ${h} is not recognized.\n\nFingerprint (SHA-256):\n${fingerprint}\n\nAccept and connect?`,
          'Accept',
          'Reject'
        );
        return accepted ? 'accept' : 'reject';
      }, option.workspace).catch(err => {
        showWarningMessage(err.message);
        return false;
      });
    };

    app.sftpBarItem.showMsg('connecting...', connectOption.connectTimeout);
    this.pendingPromise = this.fs
      .connect(connectOption, {
        askForPasswd,
        verifyHostKey,
      })
      .then(
        () => {
          app.sftpBarItem.reset();
          this.isValid = true;
          setConnectionState(this._identity, option.host, option.protocol, 'connected');
          return this.fs;
        },
        err => {
          this.fs.end();
          setConnectionState(this._identity, option.host, option.protocol, 'error');
          this.invalid('error');
          throw err;
        }
      );

    return this.pendingPromise;
  }

  invalid(_reason: string) {
    this.pendingPromise = null;
    this.fs.end();
    this.isValid = false;
    if (this._identity) {
      setConnectionState(this._identity, '', '', 'disconnected');
    }
  }

  end() {
    this.fs.end();
    if (this._identity) {
      removeConnection(this._identity);
    }
  }
}

function getLocalFs() {
  return Promise.resolve(localFs);
}

const fsTable: {
  [x: string]: KeepAliveRemoteFs;
} = {};

export function createRemoteIfNoneExist(option): Promise<FileSystem> {
  if (option.protocol === 'local') {
    return getLocalFs();
  }

  const identity = hashOption(option);
  const fs = fsTable[identity];
  if (fs !== undefined) {
    return fs.getFs(option);
  }

  const fsInstance = new KeepAliveRemoteFs();
  fsInstance.setIdentity(identity);
  fsTable[identity] = fsInstance;
  return fsInstance.getFs(option);
}

export function removeRemoteFs(option) {
  const identity = hashOption(option);
  const fs = fsTable[identity];
  if (fs !== undefined) {
    fs.end();
    delete fsTable[identity];
  }
}

export function getAllRemoteFs(): KeepAliveRemoteFs[] {
  return Object.values(fsTable);
}
