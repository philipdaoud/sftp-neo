import { window } from 'vscode';
import { COMMAND_RENAME_REMOTE } from '../constants';
import { upath } from '../core';
import { handleCtxFromUri, renameRemote } from '../fileHandlers';
import { isRemotePathAtOrUnder } from '../helper';
import { showErrorMessage } from '../host';
import { checkCommand } from './abstract/createCommand';
import { uriFromExplorerContextOrEditorContext } from './shared';

export default checkCommand({
  id: COMMAND_RENAME_REMOTE,

  async handleCommand(item, items) {
    const target = uriFromExplorerContextOrEditorContext(item, items);
    if (!target) {
      return;
    }

    if (Array.isArray(target) && target.length > 1) {
      showErrorMessage('SFTP: Rename works on one item at a time.');
      return;
    }

    const uri = Array.isArray(target) ? target[0] : target;
    const ctx = handleCtxFromUri(uri);
    const oldRemotePath = ctx.target.remoteFsPath;
    const parent = upath.dirname(oldRemotePath);
    const oldName = upath.basename(oldRemotePath);
    const root = ctx.config.remotePath;

    if (oldRemotePath === root) {
      showErrorMessage("SFTP: Can't rename the remote root folder.");
      return;
    }

    // Preselect the name without its extension, matching the editor's own rename.
    const stemLength = oldName.length - upath.extname(oldName).length;

    const newName = await window.showInputBox({
      value: oldName,
      valueSelection: [0, stemLength],
      prompt: `Rename on ${ctx.config.host} (use / to move into another folder)`,
      validateInput(value) {
        const trimmed = value.trim();
        if (!trimmed) {
          return 'Name cannot be empty.';
        }

        if (!isRemotePathAtOrUnder(root, upath.join(parent, trimmed))) {
          return `Destination must stay inside ${root}.`;
        }

        return null;
      },
    });

    if (newName === undefined) {
      return;
    }

    const newRemotePath = upath.join(parent, newName.trim());
    if (newRemotePath === oldRemotePath) {
      return;
    }

    // Command.run reports anything that escapes here.
    await renameRemote(ctx, { newRemotePath });
  },
});
