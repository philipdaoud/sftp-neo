import { Client } from 'basic-ftp';
import RemoteClient, { ConnectOption } from './remoteClient';

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

export default class FTPClient extends RemoteClient {
  _initClient() {
    const client = new Client(this._option.connectTimeout || 10000);
    return createSerializedClient(client);
  }

  _hasProvideAuth(connectOption: ConnectOption) {
    return connectOption.password != undefined;
  }

  onDisconnected() {
    // basic-ftp Client is not an EventEmitter and has no .on() method.
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
