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

  test('pruneBackups deletes files beyond the version limit', async () => {
    vol.fromJSON({
      '/var/www/.vscode/sftp-backup/index.php.20260601000000.bak': 'old1',
      '/var/www/.vscode/sftp-backup/index.php.20260602000000.bak': 'old2',
      '/var/www/.vscode/sftp-backup/index.php.20260603000000.bak': 'old3',
      '/var/www/.vscode/sftp-backup/index.php.20260604000000.bak': 'recent1',
      '/var/www/.vscode/sftp-backup/index.php.20260605000000.bak': 'recent2',
    }, '/');
    const fs = createRemoteFs();

    await pruneBackups('/var/www/index.php', fs, {
      enabled: true,
      folder: '.vscode/sftp-backup',
      versions: 2,
    }, '/var/www');

    const remaining = vol.toJSON('/var/www/.vscode/sftp-backup');
    const backupFiles = Object.keys(remaining).filter(p => p.endsWith('.bak'));
    expect(backupFiles.length).toBe(2);
    expect(vol.existsSync('/var/www/.vscode/sftp-backup/index.php.20260604000000.bak')).toBe(true);
    expect(vol.existsSync('/var/www/.vscode/sftp-backup/index.php.20260605000000.bak')).toBe(true);
    expect(vol.existsSync('/var/www/.vscode/sftp-backup/index.php.20260603000000.bak')).toBe(false);
  });
});
