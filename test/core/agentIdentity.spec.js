const { BaseAgent, utils } = require('ssh2');
const {
  getPublicKeyBlob,
  SelectiveAgent,
  agentHasIdentity,
} = require('../../src/core/remote-client/agentIdentity');

function keyPair(passphrase) {
  return utils.generateKeyPairSync(
    'ed25519',
    passphrase ? { passphrase, cipher: 'aes256-ctr' } : {}
  );
}

function blobOf(publicKey) {
  return utils.parseKey(publicKey).getPublicSSH();
}

class FakeAgent extends BaseAgent {
  constructor(publicKeys) {
    super();
    this.keys = publicKeys.map(k => utils.parseKey(k));
    this.sign = jest.fn((pubKey, data, options, cb) => cb(null, Buffer.from('sig')));
  }
  getIdentities(cb) {
    cb(null, this.keys);
  }
}

function identities(agent) {
  return new Promise((resolve, reject) =>
    agent.getIdentities((err, keys) => (err ? reject(err) : resolve(keys)))
  );
}

describe('getPublicKeyBlob', () => {
  test('reads the public key from an encrypted OpenSSH key without a passphrase', () => {
    const pair = keyPair('secret');
    expect(utils.parseKey(pair.private)).toBeInstanceOf(Error);
    expect(getPublicKeyBlob(pair.private).equals(blobOf(pair.public))).toBe(true);
  });

  test('reads the public key from an unencrypted key', () => {
    const pair = keyPair();
    expect(getPublicKeyBlob(pair.private).equals(blobOf(pair.public))).toBe(true);
  });

  test('falls back to the .pub content when the key format has no public header', () => {
    const pair = keyPair();
    expect(getPublicKeyBlob('not a key', pair.public).equals(blobOf(pair.public))).toBe(true);
  });

  test('returns undefined when nothing can be parsed', () => {
    expect(getPublicKeyBlob('not a key')).toBeUndefined();
  });
});

describe('SelectiveAgent', () => {
  const others = Array.from({ length: 7 }, () => keyPair().public);
  const target = keyPair('secret');
  const agentKeys = [...others.slice(0, 4), target.public, ...others.slice(4)];
  const targetBlob = getPublicKeyBlob(target.private);

  test('offers the matching identity first and keeps the others', async () => {
    const agent = new SelectiveAgent(new FakeAgent(agentKeys), targetBlob, false);
    const keys = await identities(agent);
    expect(keys).toHaveLength(8);
    expect(keys[0].getPublicSSH().equals(targetBlob)).toBe(true);
  });

  test('offers only the matching identity with identitiesOnly', async () => {
    const agent = new SelectiveAgent(new FakeAgent(agentKeys), targetBlob, true);
    const keys = await identities(agent);
    expect(keys).toHaveLength(1);
    expect(keys[0].getPublicSSH().equals(targetBlob)).toBe(true);
  });

  test('offers nothing with identitiesOnly when the agent lacks the key', async () => {
    const agent = new SelectiveAgent(new FakeAgent(others), targetBlob, true);
    expect(await identities(agent)).toEqual([]);
  });

  test('delegates signing to the wrapped agent', done => {
    const inner = new FakeAgent(agentKeys);
    const agent = new SelectiveAgent(inner, targetBlob, true);
    agent.sign('key', Buffer.from('data'), {}, (err, sig) => {
      expect(err).toBeNull();
      expect(sig.toString()).toBe('sig');
      expect(inner.sign).toHaveBeenCalled();
      done();
    });
  });

  test('agentHasIdentity reports whether the agent holds the key', async () => {
    expect(await agentHasIdentity(new FakeAgent(agentKeys), targetBlob)).toBe(true);
    expect(await agentHasIdentity(new FakeAgent(others), targetBlob)).toBe(false);
  });
});
