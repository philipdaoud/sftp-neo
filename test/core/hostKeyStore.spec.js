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

const { checkHostKey, fingerprint } = require('../../src/core/remote-client/hostKeyStore');
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
});
