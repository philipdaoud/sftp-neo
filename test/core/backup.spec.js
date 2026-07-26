jest.mock('fs');

const { vol } = require('memfs');
const path = require('path');
const {
  getBackupFolder,
  getBackupDirForTarget,
  getBackupPath,
  parseBackupPath,
  createBackup,
  pruneBackups,
} = require('../../src/core/backup');
const LocalRemoteFileSystem = require('../../test/helper/localRemoteFs').default;
const localfs = require('../../src/core/localFs').default;

function createRemoteFs() {
  return new LocalRemoteFileSystem(path, {
    clientOption: {},
    remoteTimeOffsetInHours: 0,
  });
}

describe('backup path utilities', () => {
  test('getBackupFolder joins remote path and backup folder', () => {
    expect(getBackupFolder('/var/www', '.vscode/sftp-backup')).toBe('/var/www/.vscode/sftp-backup');
  });

  test('getBackupDirForTarget preserves relative directory structure', () => {
    expect(getBackupDirForTarget('/var/www/css/main.css', '.vscode/sftp-backup', '/var/www')).toBe(
      '/var/www/.vscode/sftp-backup/css'
    );
    expect(getBackupDirForTarget('/var/www/index.php', '.vscode/sftp-backup', '/var/www')).toBe(
      '/var/www/.vscode/sftp-backup'
    );
  });

  test('getBackupPath generates timestamped backup path', () => {
    const date = new Date(Date.UTC(2026, 5, 12, 19, 42, 2, 123));
    const path = getBackupPath('/var/www/index.php', '.vscode/sftp-backup', '/var/www', date);
    expect(path).toBe('/var/www/.vscode/sftp-backup/index.php.20260612194202123.bak');
  });

  test('parseBackupPath reconstructs original path and timestamp', () => {
    const backupPath = '/var/www/.vscode/sftp-backup/css/main.css.20260612194202123.bak';
    const info = parseBackupPath(backupPath, '.vscode/sftp-backup', '/var/www');
    expect(info).not.toBeNull();
    expect(info.originalPath).toBe('/var/www/css/main.css');
    expect(info.timestamp.toISOString()).toBe('2026-06-12T19:42:02.123Z');
  });

  test('parseBackupPath returns null for non-backup paths', () => {
    expect(parseBackupPath('/var/www/index.php', '.vscode/sftp-backup', '/var/www')).toBeNull();
    expect(parseBackupPath('/var/www/.vscode/sftp-backup/index.php', '.vscode/sftp-backup', '/var/www')).toBeNull();
  });

  test('getBackupPath uses local storage root and path resolver', () => {
    const date = new Date(Date.UTC(2026, 5, 12, 19, 42, 2, 123));
    const backupRoot = path.join('/workspace', '.vscode/sftp-backup');
    const backupPath = getBackupPath('/var/www/index.php', '.vscode/sftp-backup', '/var/www', date, backupRoot, path);
    expect(backupPath).toBe(path.join('/workspace', '.vscode/sftp-backup', 'index.php.20260612194202123.bak'));
  });

  test('getBackupPath preserves remote directory layout under local storage root', () => {
    const date = new Date(Date.UTC(2026, 5, 12, 19, 42, 2, 123));
    const backupRoot = path.join('/workspace', '.vscode/sftp-backup');
    const backupPath = getBackupPath('/var/www/css/main.css', '.vscode/sftp-backup', '/var/www', date, backupRoot, path);
    expect(backupPath).toBe(path.join('/workspace', '.vscode/sftp-backup', 'css', 'main.css.20260612194202123.bak'));
  });

  test('parseBackupPath reconstructs original path from local backup path', () => {
    const backupRoot = path.join('/workspace', '.vscode/sftp-backup');
    const backupPath = path.join('/workspace', '.vscode/sftp-backup', 'css', 'main.css.20260612194202123.bak');
    const info = parseBackupPath(backupPath, '.vscode/sftp-backup', '/var/www', backupRoot, path);
    expect(info).not.toBeNull();
    expect(info.originalPath).toBe('/var/www/css/main.css');
    expect(info.timestamp.toISOString()).toBe('2026-06-12T19:42:02.123Z');
  });
});

describe('backup lifecycle', () => {
  afterEach(() => {
    vol.reset();
  });

  test('createBackup copies remote file to backup folder', async () => {
    vol.fromJSON({ '/var/www/index.php': 'original content' }, '/');
    const fs = createRemoteFs();

    const backupPath = await createBackup('/var/www/index.php', fs, {
      enabled: true,
      folder: '.vscode/sftp-backup',
      versions: 5,
    }, '/var/www');

    expect(backupPath).not.toBeNull();
    expect(backupPath.startsWith('/var/www/.vscode/sftp-backup/index.php.')).toBe(true);
    expect(backupPath.endsWith('.bak')).toBe(true);
    expect(vol.existsSync(backupPath)).toBe(true);
    expect(vol.readFileSync(backupPath, 'utf8')).toBe('original content');
  });

  test('createBackup keeps only the configured number of versions', async () => {
    vol.fromJSON({ '/var/www/index.php': 'v1' }, '/');
    const fs = createRemoteFs();
    const backupConfig = {
      enabled: true,
      folder: '.vscode/sftp-backup',
      versions: 3,
    };

    const paths = [];
    for (let i = 0; i < 5; i++) {
      vol.writeFileSync('/var/www/index.php', `v${i + 1}`);
      const backupPath = await createBackup('/var/www/index.php', fs, backupConfig, '/var/www');
      paths.push(backupPath);
    }

    const remaining = vol.toJSON('/var/www/.vscode/sftp-backup');
    const backupFiles = Object.keys(remaining).filter(p => p.endsWith('.bak'));
    expect(backupFiles.length).toBe(3);

    // Because each backup now gets a unique millisecond timestamp, none overwrite each other.
    // Prune keeps the 3 newest.
    expect(vol.existsSync(paths[2])).toBe(true);
    expect(vol.existsSync(paths[3])).toBe(true);
    expect(vol.existsSync(paths[4])).toBe(true);
  });

  test('createBackup copies remote file to local backup folder', async () => {
    vol.fromJSON({ '/var/www/index.php': 'original content' }, '/');
    const remoteFs = createRemoteFs();
    const storage = {
      fs: localfs,
      root: path.join('/workspace', '.vscode/sftp-backup'),
      pathResolver: path,
    };

    const backupPath = await createBackup('/var/www/index.php', remoteFs, {
      enabled: true,
      location: 'local',
      folder: '.vscode/sftp-backup',
      versions: 5,
    }, '/var/www', storage);

    expect(backupPath).not.toBeNull();
    expect(backupPath.startsWith(path.join('/workspace', '.vscode/sftp-backup', 'index.php.'))).toBe(true);
    expect(backupPath.endsWith('.bak')).toBe(true);
    expect(vol.existsSync(backupPath)).toBe(true);
    expect(vol.readFileSync(backupPath, 'utf8')).toBe('original content');
  });

  test('createBackup keeps only the configured number of local versions', async () => {
    vol.fromJSON({ '/var/www/index.php': 'v1' }, '/');
    const remoteFs = createRemoteFs();
    const storage = {
      fs: localfs,
      root: path.join('/workspace', '.vscode/sftp-backup'),
      pathResolver: path,
    };
    const backupConfig = {
      enabled: true,
      location: 'local',
      folder: '.vscode/sftp-backup',
      versions: 3,
    };

    const paths = [];
    for (let i = 0; i < 5; i++) {
      vol.writeFileSync('/var/www/index.php', `v${i + 1}`);
      const backupPath = await createBackup('/var/www/index.php', remoteFs, backupConfig, '/var/www', storage);
      paths.push(backupPath);
    }

    const remaining = vol.toJSON(path.join('/workspace', '.vscode/sftp-backup'));
    const backupFiles = Object.keys(remaining).filter(p => p.endsWith('.bak'));
    expect(backupFiles.length).toBe(3);

    expect(vol.existsSync(paths[2])).toBe(true);
    expect(vol.existsSync(paths[3])).toBe(true);
    expect(vol.existsSync(paths[4])).toBe(true);
  });

  test('pruneBackups deletes local files beyond the version limit', async () => {
    vol.fromJSON({
      [path.join('/workspace', '.vscode/sftp-backup', 'index.php.20260601000000.bak')]: 'old1',
      [path.join('/workspace', '.vscode/sftp-backup', 'index.php.20260602000000.bak')]: 'old2',
      [path.join('/workspace', '.vscode/sftp-backup', 'index.php.20260603000000.bak')]: 'old3',
      [path.join('/workspace', '.vscode/sftp-backup', 'index.php.20260604000000.bak')]: 'recent1',
      [path.join('/workspace', '.vscode/sftp-backup', 'index.php.20260605000000.bak')]: 'recent2',
    }, '/');
    const remoteFs = createRemoteFs();
    const storage = {
      fs: localfs,
      root: path.join('/workspace', '.vscode/sftp-backup'),
      pathResolver: path,
    };

    await pruneBackups('/var/www/index.php', remoteFs, {
      enabled: true,
      location: 'local',
      folder: '.vscode/sftp-backup',
      versions: 2,
    }, '/var/www', storage);

    const remaining = vol.toJSON(path.join('/workspace', '.vscode/sftp-backup'));
    const backupFiles = Object.keys(remaining).filter(p => p.endsWith('.bak'));
    expect(backupFiles.length).toBe(2);
    expect(vol.existsSync(path.join('/workspace', '.vscode/sftp-backup', 'index.php.20260604000000.bak'))).toBe(true);
    expect(vol.existsSync(path.join('/workspace', '.vscode/sftp-backup', 'index.php.20260605000000.bak'))).toBe(true);
    expect(vol.existsSync(path.join('/workspace', '.vscode/sftp-backup', 'index.php.20260603000000.bak'))).toBe(false);
  });
});

describe('backupBeforeDelete', () => {
  const { backupBeforeDelete } = require('../../src/core/backup');

  const baseConfig = {
    enabled: true,
    folder: '.vscode/sftp-backup',
    versions: 5,
    onDelete: true,
  };

  function backupFiles(root) {
    return Object.keys(vol.toJSON(root) || {}).filter(p => p.endsWith('.bak'));
  }

  // FileSystem methods are defined as non-writable prototype properties, so an
  // override has to be installed with defineProperty rather than assignment.
  function withFailingGet(fs, shouldFail) {
    const wrapper = Object.create(fs);
    Object.defineProperty(wrapper, 'get', {
      configurable: true,
      writable: true,
      value: (p, option) =>
        shouldFail(p) ? Promise.reject(new Error('read failed')) : fs.get(p, option),
    });
    return wrapper;
  }

  afterEach(() => {
    vol.reset();
  });

  test('is a no-op unless onDelete is on', async () => {
    vol.fromJSON({ '/var/www/index.php': 'content' }, '/');
    const fs = createRemoteFs();

    const count = await backupBeforeDelete(
      '/var/www/index.php',
      fs,
      { ...baseConfig, onDelete: false },
      '/var/www'
    );

    expect(count).toBe(0);
    expect(vol.existsSync('/var/www/.vscode/sftp-backup')).toBe(false);
  });

  test('is a no-op when backups are disabled entirely', async () => {
    vol.fromJSON({ '/var/www/index.php': 'content' }, '/');
    const fs = createRemoteFs();

    const count = await backupBeforeDelete(
      '/var/www/index.php',
      fs,
      { ...baseConfig, enabled: false },
      '/var/www'
    );

    expect(count).toBe(0);
  });

  test('backs up a single file', async () => {
    vol.fromJSON({ '/var/www/index.php': 'content' }, '/');
    const fs = createRemoteFs();

    const count = await backupBeforeDelete('/var/www/index.php', fs, baseConfig, '/var/www');

    expect(count).toBe(1);
    const backups = backupFiles('/var/www/.vscode/sftp-backup');
    expect(backups.length).toBe(1);
    expect(vol.readFileSync(backups[0], 'utf8')).toBe('content');
  });

  test('backs up every file in a folder, preserving layout', async () => {
    vol.fromJSON(
      {
        '/var/www/site/index.php': 'index',
        '/var/www/site/css/main.css': 'css',
        '/var/www/site/js/deep/app.js': 'js',
        '/var/www/untouched.txt': 'keep',
      },
      '/'
    );
    const fs = createRemoteFs();

    const count = await backupBeforeDelete('/var/www/site', fs, baseConfig, '/var/www');

    expect(count).toBe(3);

    const backupRoot = '/var/www/.vscode/sftp-backup';
    const backups = backupFiles(backupRoot);
    expect(backups.length).toBe(3);

    // Relative directory layout is preserved under the backup root.
    expect(backups.some(p => p.startsWith(`${backupRoot}/site/index.php.`))).toBe(true);
    expect(backups.some(p => p.startsWith(`${backupRoot}/site/css/main.css.`))).toBe(true);
    expect(backups.some(p => p.startsWith(`${backupRoot}/site/js/deep/app.js.`))).toBe(true);

    // Files outside the delete target are not touched.
    expect(backups.some(p => p.includes('untouched'))).toBe(false);
  });

  test('does not descend into the remote backup folder itself', async () => {
    vol.fromJSON(
      {
        '/var/www/index.php': 'index',
        '/var/www/.vscode/sftp-backup/index.php.20260603000000.bak': 'old backup',
      },
      '/'
    );
    const fs = createRemoteFs();

    const count = await backupBeforeDelete('/var/www', fs, baseConfig, '/var/www');

    // Only index.php, never the pre-existing .bak.
    expect(count).toBe(1);
  });

  test('skips symlinks rather than copying what they point at', async () => {
    vol.fromJSON({ '/var/www/real.txt': 'real' }, '/');
    vol.symlinkSync('/var/www/real.txt', '/var/www/link.txt');
    const fs = createRemoteFs();

    const count = await backupBeforeDelete('/var/www/link.txt', fs, baseConfig, '/var/www');

    expect(count).toBe(0);
  });

  test('throws instead of returning when a backup cannot be made', async () => {
    vol.fromJSON(
      {
        '/var/www/site/a.txt': 'a',
        '/var/www/site/b.txt': 'b',
      },
      '/'
    );
    const fs = createRemoteFs();

    // Delegate to the real fs, but fail reading one of the two files.
    // The fs methods are non-writable prototype properties, so plain
    // assignment on a derived object silently does nothing.
    const flaky = withFailingGet(fs, p => p.endsWith('b.txt'));

    await expect(
      backupBeforeDelete('/var/www/site', flaky, baseConfig, '/var/www')
    ).rejects.toThrow(/could not back up/);
  });

  test('a failed backup leaves the delete to the caller, which never runs', async () => {
    // Guards the contract removeRemote relies on: backupBeforeDelete throws
    // before any removal happens, so nothing is deleted on a partial backup.
    vol.fromJSON({ '/var/www/site/a.txt': 'a' }, '/');
    const fs = createRemoteFs();

    const flaky = withFailingGet(fs, () => true);

    await expect(
      backupBeforeDelete('/var/www/site', flaky, baseConfig, '/var/www')
    ).rejects.toThrow();

    expect(vol.existsSync('/var/www/site/a.txt')).toBe(true);
  });
});
