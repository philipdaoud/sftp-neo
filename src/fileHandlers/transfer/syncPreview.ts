import * as vscode from 'vscode';
import { FileType, TransferDirection } from '../../core';
import { SyncPlan, SyncPlanItem, syncPlanKey } from './transfer';

interface PreviewItem extends vscode.QuickPickItem {
  key?: string;
}

interface PreviewRoots {
  localRoot: string;
  remoteRoot: string;
}

function relative(fsPath: string, root: string) {
  if (fsPath === root) {
    return fsPath;
  }
  return fsPath.startsWith(root) ? fsPath.slice(root.length).replace(/^[\\/]+/, '') : fsPath;
}

function planItems(plan: SyncPlan) {
  const items: SyncPlanItem[] = [
    ...plan.transfers.map(task => ({ kind: 'transfer' as const, task })),
    ...plan.folders.map(folder => ({ kind: 'folder' as const, folder })),
    ...plan.deletions.map(entry => ({ kind: 'delete' as const, entry })),
  ];
  return items;
}

export function describeSyncPlan(plan: SyncPlan) {
  const createdFiles = plan.transfers.filter(t => t.syncAction === 'create').length;
  const created = createdFiles + plan.folders.length;
  const updated = plan.transfers.length - createdFiles;
  const parts: string[] = [];
  if (created) parts.push(`${created} new`);
  if (updated) parts.push(`${updated} changed`);
  if (plan.deletions.length) {
    parts.push(`${plan.deletions.length} deletion${plan.deletions.length === 1 ? '' : 's'}`);
  }
  return parts.join(' · ');
}

/**
 * Show every planned change as a pre-checked list. Resolves with the keys the
 * user kept (see `syncPlanKey`), or `undefined` when the preview is dismissed.
 */
export function showSyncPreview(
  plan: SyncPlan,
  roots: PreviewRoots
): Promise<Set<string> | undefined> {
  const rootOf = (direction: TransferDirection) =>
    direction === TransferDirection.LOCAL_TO_REMOTE ? roots.remoteRoot : roots.localRoot;

  const groups: { label: string; items: PreviewItem[] }[] = [
    { label: 'Upload – new', items: [] },
    { label: 'Upload – changed', items: [] },
    { label: 'Download – new', items: [] },
    { label: 'Download – changed', items: [] },
    {
      label:
        plan.deletionDirection === TransferDirection.LOCAL_TO_REMOTE
          ? 'Delete on remote'
          : 'Delete locally',
      items: [],
    },
  ];

  for (const item of planItems(plan)) {
    const key = syncPlanKey(item);
    if (item.kind === 'delete') {
      const isDir = item.entry.type === FileType.Directory;
      groups[4].items.push({
        key,
        label: `$(trash) ${relative(item.entry.fspath, rootOf(plan.deletionDirection))}`,
        description: isDir ? 'folder and its contents' : undefined,
      });
      continue;
    }
    if (item.kind === 'folder') {
      const isUpload = item.folder.direction === TransferDirection.LOCAL_TO_REMOTE;
      groups[isUpload ? 0 : 2].items.push({
        key,
        label: `$(new-folder) ${relative(item.folder.fsPath, rootOf(item.folder.direction))}`,
        description: 'empty folder',
      });
      continue;
    }
    const { task } = item;
    const isUpload = task.transferType === TransferDirection.LOCAL_TO_REMOTE;
    const isNew = task.syncAction === 'create';
    groups[(isUpload ? 0 : 2) + (isNew ? 0 : 1)].items.push({
      key,
      label: `${isNew ? '$(diff-added)' : '$(diff-modified)'} ${relative(
        task.targetFsPath,
        rootOf(task.transferType)
      )}`,
    });
  }

  const items: PreviewItem[] = [];
  for (const group of groups) {
    if (!group.items.length) continue;
    group.items.sort((a, b) => a.label.localeCompare(b.label));
    items.push({ label: group.label, kind: vscode.QuickPickItemKind.Separator }, ...group.items);
  }

  const selectable = items.filter(i => i.key);
  const quickPick = vscode.window.createQuickPick<PreviewItem>();
  quickPick.title = `Preview Sync — ${describeSyncPlan(plan)}`;
  quickPick.placeholder = 'Uncheck anything you want to skip, then press Enter to sync';
  quickPick.canSelectMany = true;
  quickPick.ignoreFocusOut = true;
  quickPick.matchOnDescription = true;
  quickPick.items = items;
  quickPick.selectedItems = selectable;

  return new Promise(resolve => {
    let accepted = false;
    quickPick.onDidAccept(() => {
      accepted = true;
      const keys = new Set(quickPick.selectedItems.map(i => i.key!).filter(Boolean));
      quickPick.hide();
      resolve(keys);
    });
    quickPick.onDidHide(() => {
      quickPick.dispose();
      if (!accepted) {
        resolve(undefined);
      }
    });
    quickPick.show();
  });
}
