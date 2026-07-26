import { Uri, window } from 'vscode';
import { COMMAND_DELETE_REMOTE } from '../constants';
import { upath } from '../core';
import { removeRemote } from '../fileHandlers';
import { getFileService } from '../modules/serviceManager';
import { checkFileCommand } from './abstract/createCommand';
import { getActiveDocumentUri, uriFromExplorerContextOrEditorContext } from './shared';

function backsUpOnDelete(uri: Uri) {
  const fileService = getFileService(uri);
  if (!fileService) {
    return false;
  }

  const { backup } = fileService.getConfig();
  return Boolean(backup && backup.enabled && backup.onDelete && backup.versions > 0);
}

export default checkFileCommand({
  id: COMMAND_DELETE_REMOTE,
  async getFileTarget(item, items) {
    // Fall back to the active editor so the command is usable from the
    // Command Palette, where there is no context item.
    const targets =
      (await uriFromExplorerContextOrEditorContext(item, items)) || getActiveDocumentUri();

    if (!targets) {
      return;
    }

    const filename = Array.isArray(targets)
      ? targets.map(t => upath.basename(t.fsPath)).join(', ')
      : upath.basename(targets.fsPath);

    const first = Array.isArray(targets) ? targets[0] : targets;
    const detail = backsUpOnDelete(first)
      ? 'A copy is saved to the backup folder first, so this can be restored. Deleting a folder backs up every file inside it and may take a while.'
      : 'This cannot be undone.';

    // Modal: this deletes on the server, and the command is now reachable from
    // the local explorer and the Command Palette, where it is easy to mistake
    // for a local delete.
    const result = await window.showWarningMessage(
      `Delete '${filename}' on the remote server?`,
      { modal: true, detail },
      'Delete'
    );

    return result === 'Delete' ? targets : undefined;
  },

  handleFile: removeRemote,
});
