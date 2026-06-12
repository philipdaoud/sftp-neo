import * as vscode from 'vscode';
import { COMMAND_REMOTE_BACKUPS_DELETE } from '../constants';
import { BackupVersion, remoteBackupsProvider } from '../modules/remoteBackups';
import { checkCommand } from './abstract/createCommand';
import * as fileOperations from '../core/fileBaseOperations';

export default checkCommand({
  id: COMMAND_REMOTE_BACKUPS_DELETE,

  async handleCommand(item: BackupVersion) {
    if (!item || !item.backupPath) {
      return;
    }

    const confirm = await vscode.window.showWarningMessage(
      `Delete backup from ${item.timestamp.toLocaleString()}?`,
      { modal: true },
      'Delete'
    );
    if (confirm !== 'Delete') {
      return;
    }

    try {
      const config = item.fileService.getConfig();
      const remoteFs = await item.fileService.getRemoteFileSystem(config);
      await fileOperations.removeFile(item.backupPath, remoteFs, undefined);
      remoteBackupsProvider.refresh();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete backup: ${error.message}`);
    }
  },
});
