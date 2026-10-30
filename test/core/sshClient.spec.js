const { EventEmitter } = require('events');

jest.mock('ssh2', () => ({
  ...jest.requireActual('ssh2'),
  createAgent: jest.fn(),
}));

const ssh2 = require('ssh2');
const { SelectiveAgent } = require('../../src/core/remote-client/agentIdentity');
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

describe('SSH key resolution with an agent', () => {
  const { BaseAgent, utils } = jest.requireActual('ssh2');
  const encrypted = utils.generateKeyPairSync('ed25519', {
    passphrase: 'secret',
    cipher: 'aes256-ctr',
  });
  const other = utils.generateKeyPairSync('ed25519');

  class FakeAgent extends BaseAgent {
    constructor(publicKeys) {
      super();
      this.keys = publicKeys.map(k => utils.parseKey(k));
    }
    getIdentities(cb) {
      cb(null, this.keys);
    }
  }

  function fakeFs(files) {
    return {
      readFile: jest.fn(async path => {
        if (!(path in files)) {
          throw new Error(`ENOENT ${path}`);
        }
        return Buffer.from(files[path]);
      }),
    };
  }

  function resolve(opt, files = { '/k': encrypted.private }) {
    const ssh = new SSHClient({ host: 'example.test', port: 22 });
    return ssh._resolveKeyAuth(opt, fakeFs(files)).then(() => opt);
  }

  test('uses the agent identity and skips the encrypted key file', async () => {
    ssh2.createAgent.mockReturnValue(new FakeAgent([other.public, encrypted.public]));
    const opt = await resolve({ host: 'h', agent: '/sock', privateKeyPath: '/k', identitiesOnly: true });
    expect(opt.privateKey).toBeUndefined();
    expect(opt.agent).toBeInstanceOf(SelectiveAgent);
  });

  test('explains when an encrypted key is not in the agent and has no passphrase', async () => {
    ssh2.createAgent.mockReturnValue(new FakeAgent([other.public]));
    await expect(
      resolve({ host: 'h', agent: '/sock', privateKeyPath: '/k' })
    ).rejects.toThrow(/not loaded in the SSH agent/);
  });

  test('falls back to the key file when the agent lacks it but a passphrase is set', async () => {
    ssh2.createAgent.mockReturnValue(new FakeAgent([other.public]));
    const opt = await resolve({ host: 'h', agent: '/sock', privateKeyPath: '/k', passphrase: 'secret' });
    expect(opt.privateKey).toBe(encrypted.private);
  });

  test('loads the key file as before when no agent is set', async () => {
    const opt = await resolve({ host: 'h', privateKeyPath: '/k' });
    expect(opt.privateKey).toBe(encrypted.private);
    expect(opt.agent).toBeUndefined();
  });
});
