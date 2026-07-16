import { Client } from 'basic-ftp';
import RemoteClient, { ConnectOption } from './remoteClient';
import logger from '../../logger';

/**
 * basic-ftp does not support concurrent commands on a single control connection.
 * Wrap the client so every method call is queued and executed one at a time.
 */
function createSerializedClient(client: Client): Client {
  let queue: Promise<unknown> = Promise.resolve();

  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const next = queue.then(
      () => task(),
      () => task()
    );
    queue = next.then(
      () => {},
      () => {}
    );
    return next;
  };

  return new Proxy(client, {
    get(target, prop) {
      const value = target[prop];
      if (typeof value === 'function') {
        return function (...args: any[]) {
          return enqueue(() => value.apply(target, args));
        };
      }
      return value;
    },
  }) as Client;
}

const DEFAULT_KEEPALIVE_MS = 30 * 1000;

export default class FTPClient extends RemoteClient {
  private _keepaliveTimer?: ReturnType<typeof setInterval>;
  private _onDisconnectedCb?: (reason: string) => void;
  private _socketListenersAttached = false;

  _initClient() {
    const client = new Client(this._option.connectTimeout || 10000);
    return createSerializedClient(client);
  }

  _hasProvideAuth(connectOption: ConnectOption) {
    return connectOption.password != undefined;
  }

  isClosed() {
    return this._client.closed;
  }

  onDisconnected(cb: (reason: string) => void) {
    this._onDisconnectedCb = cb;
    this._attachSocketListeners();
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

    this._attachSocketListeners();
    this._startKeepalive(connectOption.keepalive);
  }

  end() {
    if (this._keepaliveTimer) {
      clearInterval(this._keepaliveTimer);
      this._keepaliveTimer = undefined;
    }
    this._client.close();
  }

  getFsClient() {
    return this._client;
  }

  private _attachSocketListeners() {
    const socket = this._client.ftp.socket;
    if (!socket || this._socketListenersAttached) {
      return;
    }

    this._socketListenersAttached = true;
    const notify = (reason: string) => {
      if (this._onDisconnectedCb) {
        this._onDisconnectedCb(reason);
      }
    };

    socket.once('end', () => notify('end'));
    socket.once('close', () => notify('close'));
    socket.once('error', () => notify('error'));
  }

  private _startKeepalive(keepalive?: number) {
    if (keepalive === 0) {
      return;
    }

    const interval = keepalive && keepalive > 0 ? keepalive : DEFAULT_KEEPALIVE_MS;
    if (this._keepaliveTimer) {
      clearInterval(this._keepaliveTimer);
    }

    this._keepaliveTimer = setInterval(() => {
      if (this._client.closed) {
        return;
      }

      // Fire-and-forget NOOP to keep the control connection alive.
      this._client.sendIgnoringError('NOOP').catch((err: unknown) => {
        logger.debug(`FTP keepalive NOOP failed: ${(err as Error).message || err}`);
      });
    }, interval);
    this._keepaliveTimer.unref();
  }
}
