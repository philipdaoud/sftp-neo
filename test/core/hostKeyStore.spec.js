const os = require('os');
const path = require('path');
const fse = require('fs-extra');

const STORE_PATH = path.join(os.homedir(), '.vscode-sftp', 'known_hosts.json');

jest.mock('fs-extra', () => {
  const actual = jest.requireActual('fs-extra');
  return {
    ...actual,
    readJson: jest.fn(() => Promise.resolve({})),
    outputJson: jest.fn(() => Promise.resolve()),
  };
});

const {
  checkHostKey,
  fingerprint,
  openSshFingerprint,
  matchesHostPattern,
  isUnrestrictedHostPattern,
} = require('../../src/core/remote-client/hostKeyStore');
const fseMock = require('fs-extra');

describe('hostKeyStore workspace-scoped keys', () => {
  const host = '10.2.1.159';
  const port = 22;
  const fpA = 'a'.repeat(64);
  const fpB = 'b'.repeat(64);

  beforeEach(() => {
    fseMock.readJson.mockReset();
    fseMock.outputJson.mockReset();
  });

  test('prompts for unknown key and saves workspace-scoped entry', async () => {
    fseMock.readJson.mockResolvedValue({});

    const result = await checkHostKey(
      host,
      port,
      fpA,
      async () => 'accept',
      '/workspace/one'
    );

    expect(result).toBe(true);
    expect(fseMock.outputJson).toHaveBeenCalledWith(
      STORE_PATH,
      { [`${host}:${port}:/workspace/one`]: fpA },
      { spaces: 2 }
    );
  });

  test('rejects when user declines unknown key', async () => {
    fseMock.readJson.mockResolvedValue({});

    const result = await checkHostKey(
      host,
      port,
      fpA,
      async () => 'reject',
      '/workspace/one'
    );

    expect(result).toBe(false);
    expect(fseMock.outputJson).not.toHaveBeenCalled();
  });

  test('migrates legacy host:port entry to workspace-scoped entry when fingerprint matches', async () => {
    fseMock.readJson.mockResolvedValue({ [`${host}:${port}`]: fpA });

    const result = await checkHostKey(
      host,
      port,
      fpA,
      async () => { throw new Error('should not prompt'); },
      '/workspace/one'
    );

    expect(result).toBe(true);
    expect(fseMock.outputJson).toHaveBeenCalledWith(
      STORE_PATH,
      {
        [`${host}:${port}`]: fpA,
        [`${host}:${port}:/workspace/one`]: fpA,
      },
      { spaces: 2 }
    );
  });

  test('prompts for unknown workspace when legacy entry exists but fingerprint differs', async () => {
    fseMock.readJson.mockResolvedValue({ [`${host}:${port}`]: fpA });

    const result = await checkHostKey(
      host,
      port,
      fpB,
      async () => 'accept',
      '/workspace/one'
    );

    expect(result).toBe(true);
    expect(fseMock.outputJson).toHaveBeenCalledWith(
      STORE_PATH,
      {
        [`${host}:${port}`]: fpA,
        [`${host}:${port}:/workspace/one`]: fpB,
      },
      { spaces: 2 }
    );
  });

  test('different workspaces can have different keys for same host:port', async () => {
    fseMock.readJson.mockResolvedValue({
      [`${host}:${port}:/workspace/one`]: fpA,
    });

    const result = await checkHostKey(
      host,
      port,
      fpB,
      async () => 'accept',
      '/workspace/two'
    );

    expect(result).toBe(true);
    expect(fseMock.outputJson).toHaveBeenCalledWith(
      STORE_PATH,
      {
        [`${host}:${port}:/workspace/one`]: fpA,
        [`${host}:${port}:/workspace/two`]: fpB,
      },
      { spaces: 2 }
    );
  });

  test('throws on key change for same workspace', async () => {
    fseMock.readJson.mockResolvedValue({
      [`${host}:${port}:/workspace/one`]: fpA,
    });

    await expect(
      checkHostKey(host, port, fpB, async () => 'accept', '/workspace/one')
    ).rejects.toThrow(/has CHANGED/);
  });

  test('legacy behavior without workspace still works', async () => {
    fseMock.readJson.mockResolvedValue({});

    const result = await checkHostKey(host, port, fpA, async () => 'accept');

    expect(result).toBe(true);
    expect(fseMock.outputJson).toHaveBeenCalledWith(
      STORE_PATH,
      { [`${host}:${port}`]: fpA },
      { spaces: 2 }
    );
  });

  describe('changed key prompt', () => {
    const ws = '/workspace/one';
    const scoped = `${host}:${port}:${ws}`;

    test('accepting a changed key replaces only this workspace entry', async () => {
      fseMock.readJson.mockResolvedValue({
        [scoped]: fpA,
        [`${host}:${port}:/workspace/two`]: fpA,
      });
      const promptChanged = jest.fn(async () => 'accept');

      const result = await checkHostKey(
        host,
        port,
        fpB,
        async () => { throw new Error('should not prompt as unknown'); },
        ws,
        { promptChanged }
      );

      expect(result).toBe(true);
      expect(promptChanged).toHaveBeenCalledWith(fpA, fpB, host);
      expect(fseMock.outputJson).toHaveBeenCalledWith(
        STORE_PATH,
        { [scoped]: fpB, [`${host}:${port}:/workspace/two`]: fpA },
        { spaces: 2 }
      );
    });

    test('cancelling a changed key refuses and keeps the stored key', async () => {
      fseMock.readJson.mockResolvedValue({ [scoped]: fpA });

      await expect(
        checkHostKey(host, port, fpB, async () => 'accept', ws, {
          promptChanged: async () => 'reject',
        })
      ).rejects.toThrow(/has CHANGED/);
      expect(fseMock.outputJson).not.toHaveBeenCalled();
    });

    test('accept-new still prompts for a changed key', async () => {
      fseMock.readJson.mockResolvedValue({ [scoped]: fpA });
      const promptChanged = jest.fn(async () => 'reject');

      await expect(
        checkHostKey(host, port, fpB, async () => 'accept', ws, {
          mode: 'accept-new',
          promptChanged,
        })
      ).rejects.toThrow(/has CHANGED/);
      expect(promptChanged).toHaveBeenCalledTimes(1);
      expect(fseMock.outputJson).not.toHaveBeenCalled();
    });
  });

  describe('accept-new', () => {
    const ws = '/workspace/one';

    test('stores an unknown key without prompting', async () => {
      fseMock.readJson.mockResolvedValue({});

      const result = await checkHostKey(
        host,
        port,
        fpA,
        async () => { throw new Error('should not prompt'); },
        ws,
        { mode: 'accept-new' }
      );

      expect(result).toBe(true);
      expect(fseMock.outputJson).toHaveBeenCalledWith(
        STORE_PATH,
        { [`${host}:${port}:${ws}`]: fpA },
        { spaces: 2 }
      );
    });

    test('treats a mismatching legacy entry as a changed key', async () => {
      fseMock.readJson.mockResolvedValue({ [`${host}:${port}`]: fpA });
      const promptChanged = jest.fn(async () => 'reject');

      await expect(
        checkHostKey(
          host,
          port,
          fpB,
          async () => { throw new Error('should not prompt as unknown'); },
          ws,
          { mode: 'accept-new', promptChanged }
        )
      ).rejects.toThrow(/has CHANGED/);
      expect(promptChanged).toHaveBeenCalledWith(fpA, fpB, host);
      expect(fseMock.outputJson).not.toHaveBeenCalled();
    });
  });
});

describe('skipVerification', () => {
  const host = 'staging.test';
  const port = 22;
  const ws = '/workspace/one';

  beforeEach(() => {
    fseMock.readJson.mockReset();
    fseMock.outputJson.mockReset();
  });

  test.each([
    ['unknown', {}],
    ['changed', { [`${host}:${port}:${ws}`]: 'a'.repeat(64) }],
  ])('accepts a %s key without prompting or touching the store', async (_label, stored) => {
    fseMock.readJson.mockResolvedValue(stored);
    const promptChanged = jest.fn();

    const result = await checkHostKey(
      host,
      port,
      'b'.repeat(64),
      async () => { throw new Error('should not prompt'); },
      ws,
      { mode: 'strict', skipVerification: true, promptChanged }
    );

    expect(result).toBe(true);
    expect(promptChanged).not.toHaveBeenCalled();
    expect(fseMock.readJson).not.toHaveBeenCalled();
    expect(fseMock.outputJson).not.toHaveBeenCalled();
  });
});

describe('matchesHostPattern', () => {
  test.each([
    ['staging.test', 22, ['staging.test'], true],
    ['STAGING.test', 22, ['staging.TEST'], true],
    ['box1.lab.local', 22, ['*.lab.local'], true],
    ['lab.local', 22, ['*.lab.local'], false],
    ['web7.test', 22, ['web?.test'], true],
    ['web17.test', 22, ['web?.test'], false],
    ['10.0.0.5', 2222, ['10.0.0.5:2222'], true],
    ['10.0.0.5', 22, ['10.0.0.5:2222'], false],
    ['10.0.0.15', 22, ['10.0.0.1'], false],
    ['stagingxtest', 22, ['staging.test'], false],
    ['fe80::1', 22, ['fe80::1'], true],
    ['fe80::1', 2222, ['[fe80::1]:22'], false],
    ['prod.example.com', 22, ['staging.test'], false],
    ['anything', 22, ['*'], false],
    ['anything', 22, ['*:22'], false],
    ['anything', 22, [], false],
  ])('%s:%d against %j -> %s', (h, p, patterns, expected) => {
    expect(matchesHostPattern(h, p, patterns)).toBe(expected);
  });

  test('flags wildcard-only patterns as unrestricted', () => {
    expect(isUnrestrictedHostPattern('*')).toBe(true);
    expect(isUnrestrictedHostPattern(' ** ')).toBe(true);
    expect(isUnrestrictedHostPattern('*:2222')).toBe(true);
    expect(isUnrestrictedHostPattern('*.test')).toBe(false);
  });
});

describe('openSshFingerprint', () => {
  test('formats a hex sha256 like ssh-keygen -lf', () => {
    const key = Buffer.from('host key bytes');
    const expected = 'SHA256:' + require('crypto')
      .createHash('sha256')
      .update(key)
      .digest('base64')
      .replace(/=+$/, '');
    expect(openSshFingerprint(fingerprint(key))).toBe(expected);
  });
});
