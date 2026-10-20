const { EventEmitter } = require('events');
const SSHClient = require('../../src/core/remote-client/sshClient').default;

// Stands in for an ssh2 Client: records the connect options so a test can
// drive the host-key callback and the ready/error events by hand.
function fakeSsh2Client() {
  const client = new EventEmitter();
  client.connect = jest.fn(opts => {
    client.opts = opts;
  });
  client.destroy = jest.fn();
  return client;
}

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('SSH connect timeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function connect(client, verifyHostKey, connectTimeout = 10000) {
    const ssh = new SSHClient({ host: 'example.test', port: 22 });
    return ssh._connectSSHClient(
      client,
      { host: 'example.test', port: 22, connectTimeout, password: 'x' },
      { askForPasswd: async () => undefined, verifyHostKey }
    );
  }

  test('disables the ssh2 timer in favour of its own', async () => {
    const client = fakeSsh2Client();
    const result = connect(client, async () => true);
    await flush();
    expect(client.opts.readyTimeout).toBe(0);
    client.emit('ready');
    await result;
  });

  test('times out a handshake that never completes', async () => {
    const client = fakeSsh2Client();
    const result = connect(client, async () => true);
    await flush();

    jest.advanceTimersByTime(10000);
    await expect(result).rejects.toThrow(/Timed out while waiting for handshake/);
    expect(client.destroy).toHaveBeenCalled();
  });

  test('does not time out while the host-key prompt is open', async () => {
    const client = fakeSsh2Client();
    let answer;
    const result = connect(client, () => new Promise(resolve => (answer = resolve)));
    await flush();

    const done = jest.fn();
    client.opts.hostVerifier(Buffer.from('key'), done);
    jest.advanceTimersByTime(60000);
    expect(client.destroy).not.toHaveBeenCalled();

    answer(true);
    await flush();
    expect(done).toHaveBeenCalledWith(true);

    client.emit('ready');
    await expect(result).resolves.toBeUndefined();
    jest.advanceTimersByTime(60000);
    expect(client.destroy).not.toHaveBeenCalled();
  });

  test('restarts the full timeout after the prompt is accepted', async () => {
    const client = fakeSsh2Client();
    let answer;
    const result = connect(client, () => new Promise(resolve => (answer = resolve)));
    await flush();

    jest.advanceTimersByTime(9000);
    client.opts.hostVerifier(Buffer.from('key'), () => undefined);
    answer(true);
    await flush();

    jest.advanceTimersByTime(9000);
    expect(client.destroy).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    await expect(result).rejects.toThrow(/Timed out/);
  });
});
