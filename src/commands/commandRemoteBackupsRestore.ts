import * as vscode from 'vscode';
import * as path from 'path';
import { COMMAND_REMOTE_BACKUPS_RESTORE } from '../constants';
import { BackupVersion } from '../modules/remoteBackups';
import { checkCommand } from './abstract/createCommand';
import localFs from '../core/localFs';
import { createBackup, BackupStorage } from '../core/backup';
import * as fileOperations from '../core/fileBaseOperations';

export default checkCommand({
  id: COMMAND_REMOTE_BACKUPS_RESTORE,

  async handleCommand(item: BackupVersion) {
    if (!item || !item.backupPath) {
      return;
    }

    const confirm = await vscode.window.showWarningMessage(
      `Restore backup from ${item.timestamp.toLocaleString()} to ${item.originalPath}?`,
      { modal: true },
      'Restore'
    );
    if (confirm !== 'Restore') {
      return;
    }

    try {
      const config = item.fileService.getConfig();
      const remoteFs = await item.fileService.getRemoteFileSystem(config);
      const backupLocation = config.backup?.location || 'remote';

      // Backup the current live file before restoring, if backups are enabled.
      if (config.backup && config.backup.enabled && config.backup.versions > 0) {
        let storage: BackupStorage | undefined;
        if (backupLocation === 'local') {
          storage = {
            fs: localFs,
            root: path.join(item.fileService.baseDir, config.backup.folder),
            pathResolver: path,
          };
        }
        await createBackup(item.originalPath, remoteFs, config.backup, config.remotePath, storage);
      }

      const backupFs = item.location === 'local' ? localFs : remoteFs;
      await fileOperations.transferFile(item.backupPath, item.originalPath, backupFs, remoteFs);
      vscode.window.showInformationMessage(`Restored backup to ${item.originalPath}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to restore backup: ${error.message}`);
    }
  },
});
