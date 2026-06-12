import * as vscode from 'vscode';
import { COMMAND_REMOTE_BACKUPS_OPEN } from '../constants';
import { BackupVersion, createBackupUri } from '../modules/remoteBackups';
import { checkCommand } from './abstract/createCommand';

export default checkCommand({
  id: COMMAND_REMOTE_BACKUPS_OPEN,

  async handleCommand(item: BackupVersion) {
    if (!item || !item.backupPath) {
      return;
    }

    const uri = createBackupUri(item.fileService.id, item.backupPath);
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: true });
  },
});
