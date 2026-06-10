import { Client } from 'basic-ftp';
import RemoteClient, { ConnectOption } from './remoteClient';

export default class FTPClient extends RemoteClient {
  _initClient() {
    return new Client(this._option.connectTimeout || 10000);
  }

  _hasProvideAuth(connectOption: ConnectOption) {
    return connectOption.password != undefined;
  }

  async _doConnect(connectOption: ConnectOption): Promise<void> {
    const client = this._client as Client;

    // Map secure option
    let secure: boolean | 'implicit' = false;
    if (connectOption.secure === true) {
      secure = true;
    } else if (connectOption.secure === 'implicit') {
      secure = 'implicit';
    } else if (connectOption.secure === 'control') {
      // basic-ftp does not support control-only TLS; use full TLS as safest fallback
      secure = true;
    }

    // Set up debug logging
    const originalDebug = connectOption.debug;
    client.ftp.log = (message: string) => {
      if (typeof message === 'string') {
        // Mask password in logs
        if (message.includes('PASS ')) {
          message = message.replace(/PASS .*/, 'PASS ******');
        }
        originalDebug(message);
      }
    };

    await client.access({
      host: connectOption.host,
      port: connectOption.port,
      user: connectOption.username,
      password: connectOption.password,
      secure,
      secureOptions: connectOption.secureOptions as any,
    });
  }

  end() {
    this._client.close();
  }

  getFsClient() {
    return this._client;
  }
}
