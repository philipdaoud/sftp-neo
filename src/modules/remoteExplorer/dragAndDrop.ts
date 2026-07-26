import * as vscode from 'vscode';
import { VIEW_REMOTE_EXPLORER } from '../../constants';
import { upath } from '../../core';
import { handleCtxFromUri, renameRemote } from '../../fileHandlers';
import { reportError } from '../../helper';
import logger from '../../logger';
import RemoteTreeData, { ExplorerItem, ExplorerRoot } from './treeDataProvider';
import { MoveCandidate, planMoves } from './movePlan';

/**
 * A tree's own drag payload travels under `application/vnd.code.tree.<id>`.
 * The documented spelling lowercases the view id, but it is described as a
 * recommendation rather than a guarantee, so accept the verbatim id too rather
 * than have a casing change turn into a silent no-op.
 */
const MIME_TYPES = [
  `application/vnd.code.tree.${VIEW_REMOTE_EXPLORER.toLowerCase()}`,
  `application/vnd.code.tree.${VIEW_REMOTE_EXPLORER}`,
];

function isRoot(item: ExplorerItem) {
  return (item as ExplorerRoot).explorerContext !== undefined;
}

function toCandidate(item: ExplorerItem): MoveCandidate {
  return {
    fsPath: item.resource.fsPath,
    remoteId: item.resource.remoteId,
    isDirectory: item.isDirectory,
  };
}

export default class RemoteExplorerDragAndDropController
  implements vscode.TreeDragAndDropController<ExplorerItem> {
  readonly dropMimeTypes = MIME_TYPES;

  // The tree's own mime type is added automatically; we offer nothing else, so
  // dragging out of the Remote Explorer does nothing.
  readonly dragMimeTypes: string[] = [];

  private _treeDataProvider: RemoteTreeData;

  constructor(treeDataProvider: RemoteTreeData) {
    this._treeDataProvider = treeDataProvider;
  }

  handleDrag(source: readonly ExplorerItem[], dataTransfer: vscode.DataTransfer): void {
    // A root is the configured remotePath itself, so there is nothing above it
    // to move it into.
    const draggable = source.filter(item => !isRoot(item));
    if (draggable.length === 0) {
      return;
    }

    // Deliberately not gated on enableDragAndDrop: the drop handler reports
    // that it's off, which beats dragging into silence.
    logger.trace(`[drag-drop] dragging ${draggable.length} item(s)`);
    for (const mimeType of MIME_TYPES) {
      dataTransfer.set(mimeType, new vscode.DataTransferItem(draggable));
    }
  }

  async handleDrop(
    target: ExplorerItem | undefined,
    dataTransfer: vscode.DataTransfer
  ): Promise<void> {
    const sources = this._readSources(dataTransfer);
    if (!sources) {
      logger.trace('[drag-drop] drop carried no Remote Explorer items; ignoring');
      return;
    }

    if (!target) {
      // Dropping on empty space is ambiguous once more than one remote is
      // configured, so require an explicit destination.
      vscode.window.showWarningMessage('SFTP: Drop onto a folder to move items.');
      return;
    }

    if (!this._isEnabledFor(target)) {
      vscode.window.showWarningMessage(
        'SFTP: Drag and drop is off for this configuration. ' +
          'Set "remoteExplorer": { "enableDragAndDrop": true } in sftp.json to enable it.'
      );
      return;
    }

    // Dropping onto a file means "into the folder holding it".
    const targetDirPath = target.isDirectory
      ? target.resource.fsPath
      : upath.dirname(target.resource.fsPath);

    const plan = planMoves(sources.map(toCandidate), {
      fsPath: targetDirPath,
      remoteId: target.resource.remoteId,
      isDirectory: true,
    });

    if (plan.rejection) {
      vscode.window.showWarningMessage(`SFTP: ${plan.rejection}`);
      return;
    }

    if (plan.moves.length === 0) {
      logger.trace(`[drag-drop] nothing to move into ${targetDirPath}`);
      return;
    }

    if (!(await this._confirm(plan.moves, targetDirPath))) {
      return;
    }

    const byPath = new Map(sources.map(item => [item.resource.fsPath, item]));

    // Sequential: these share one connection, and a failure part-way through
    // shouldn't leave later moves racing a half-updated tree.
    for (const move of plan.moves) {
      const item = byPath.get(move.from);
      if (!item) {
        continue;
      }

      logger.info(`[drag-drop] ${move.from} ➞ ${move.to}`);
      try {
        await renameRemote(handleCtxFromUri(item.resource.uri), { newRemotePath: move.to });
      } catch (error) {
        reportError(error);
      }
    }
  }

  private _readSources(dataTransfer: vscode.DataTransfer): ExplorerItem[] | null {
    for (const mimeType of MIME_TYPES) {
      const transferItem = dataTransfer.get(mimeType);
      if (!transferItem) {
        continue;
      }

      const value = transferItem.value;
      if (Array.isArray(value) && value.length > 0) {
        return value as ExplorerItem[];
      }
    }

    return null;
  }

  private _isEnabledFor(item: ExplorerItem): boolean {
    const root = this._treeDataProvider.findRoot(item.resource.uri);
    if (!root) {
      return false;
    }

    const { remoteExplorer } = root.explorerContext.config;
    return Boolean(remoteExplorer && remoteExplorer.enableDragAndDrop);
  }

  /**
   * Moving a single file is cheap and trivially undone by dragging it back.
   * Anything bigger gets a confirmation, because a stray drag on a folder
   * reorganises a live server.
   */
  private async _confirm(moves: ReturnType<typeof planMoves>['moves'], targetDirPath: string) {
    const movesFolder = moves.some(move => move.isDirectory);
    if (!movesFolder && moves.length === 1) {
      return true;
    }

    const what =
      moves.length === 1 ? `'${upath.basename(moves[0].from)}'` : `${moves.length} items`;

    const answer = await vscode.window.showWarningMessage(
      `Move ${what} to '${targetDirPath}' on the remote server?`,
      { modal: true },
      'Move'
    );

    return answer === 'Move';
  }
}
