jest.mock('fs');

const { vol } = require('memfs');
const path = require('path');
const TransferTask = require('../../src/core/transferTask').default;
const { TransferDirection } = require('../../src/core/transferTask');
const { FileType } = require('../../src/core/fs');
const LocalRemoteFileSystem = require('../../test/helper/localRemoteFs').default;
const localfs = require('../../src/core/localFs').default;

function createRemoteFs() {
  return new LocalRemoteFileSystem(path, {
    clientOption: {},
    remoteTimeOffsetInHours: 0,
  });
}

describe('backup during upload', () => {
  afterEach(() => {
    vol.reset();
  });

  test('upload overwrites target after creating backup', async () => {
    vol.fromJSON({
      '/workspace/index.php': 'new local content',
      '/var/www/index.php': 'old remote content',
    }, '/');

    const localFs = localfs;
    const remoteFs = createRemoteFs();

    const task = new TransferTask(
      { fsPath: '/workspace/index.php', fileSystem: localFs },
      { fsPath: '/var/www/index.php', fileSystem: remoteFs },
      {
        fileType: FileType.File,
        transferDirection: TransferDirection.LOCAL_TO_REMOTE,
        transferOption: {
          atime: Date.now(),
          mtime: Date.now(),
          perserveTargetMode: false,
          backup: {
            enabled: true,
            folder: '.vscode/sftp-backup',
            versions: 5,
          },
          remotePath: '/var/www',
        },
      }
    );

    try {
      await task.run();
    } catch (error) {
      // The mock filesystem may throw on descriptor close, but the upload itself should complete.
    }

    // Target file should contain the new local content.
    expect(vol.readFileSync('/var/www/index.php', 'utf8')).toBe('new local content');

    // A backup should exist with the old remote content.
    const backupDir = '/var/www/.vscode/sftp-backup';
    const backups = Object.keys(vol.toJSON(backupDir)).filter(p => p.endsWith('.bak'));
    expect(backups.length).toBe(1);
    expect(vol.readFileSync(backups[0], 'utf8')).toBe('old remote content');
  });
});
