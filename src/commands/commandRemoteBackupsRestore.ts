import * as vscode from 'vscode';
import { COMMAND_REMOTE_BACKUPS_RESTORE } from '../constants';
import { BackupVersion } from '../modules/remoteBackups';
import { checkCommand } from './abstract/createCommand';
import { createBackup } from '../core/backup';
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

      // Backup the current live file before restoring, if backups are enabled.
      if (config.backup && config.backup.enabled && config.backup.versions > 0) {
        await createBackup(item.originalPath, remoteFs, config.backup, config.remotePath);
      }

      await fileOperations.transferFile(item.backupPath, item.originalPath, remoteFs, remoteFs);
      vscode.window.showInformationMessage(`Restored backup to ${item.originalPath}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to restore backup: ${error.message}`);
    }
  },
});
