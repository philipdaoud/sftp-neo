import * as vscode from 'vscode';
import TransferTask from '../core/transferTask';

interface QueueItem {
  id: string;
  task: TransferTask;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  startTime?: number;
  endTime?: number;
}

let _idCounter = 0;

class TransferQueueProvider implements vscode.TreeDataProvider<QueueItem> {
  private _items: QueueItem[] = [];
  private _onDidChange: vscode.EventEmitter<QueueItem | undefined> = new vscode.EventEmitter<QueueItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<QueueItem | undefined> = this._onDidChange.event;

  add(task: TransferTask): string {
    const id = `transfer-${++_idCounter}`;
    this._items.push({ id, task, status: 'pending' });
    this._onDidChange.fire(undefined);
    return id;
  }

  start(id: string) {
    const item = this._items.find(i => i.id === id);
    if (item) {
      item.status = 'running';
      item.startTime = Date.now();
      this._onDidChange.fire(item);
    }
  }

  done(id: string, error?: Error) {
    const item = this._items.find(i => i.id === id);
    if (item) {
      item.status = error ? 'failed' : 'completed';
      item.endTime = Date.now();
      if (error) {
        item.error = error.message;
      }
      this._onDidChange.fire(item);
      // Auto-remove completed items after 5 seconds
      setTimeout(() => {
        this.remove(id);
      }, 5000);
    }
  }

  cancel(id: string) {
    const item = this._items.find(i => i.id === id);
    if (item) {
      item.status = 'cancelled';
      item.endTime = Date.now();
      item.task.cancel();
      this._onDidChange.fire(item);
      setTimeout(() => this.remove(id), 3000);
    }
  }

  remove(id: string) {
    const index = this._items.findIndex(i => i.id === id);
    if (index !== -1) {
      this._items.splice(index, 1);
      this._onDidChange.fire(undefined);
    }
  }

  clearCompleted() {
    this._items = this._items.filter(i => i.status === 'pending' || i.status === 'running');
    this._onDidChange.fire(undefined);
  }

  getTreeItem(item: QueueItem): vscode.TreeItem {
    const task = item.task;
    const icon = this._getIcon(item.status);
    const duration = item.endTime && item.startTime
      ? ` (${((item.endTime - item.startTime) / 1000).toFixed(1)}s)`
      : '';
    const label = `${task.transferType} ${task.localFsPath}${duration}`;

    return {
      id: item.id,
      label,
      iconPath: new vscode.ThemeIcon(icon),
      tooltip: item.error || label,
      contextValue: item.status === 'pending' || item.status === 'running' ? 'activeTransfer' : 'transfer',
      collapsibleState: vscode.TreeItemCollapsibleState.None,
    };
  }

  getChildren(): QueueItem[] {
    return [...this._items].reverse();
  }

  private _getIcon(status: QueueItem['status']): string {
    switch (status) {
      case 'pending': return 'clock';
      case 'running': return 'sync~spin';
      case 'completed': return 'check';
      case 'failed': return 'error';
      case 'cancelled': return 'close';
      default: return 'file';
    }
  }
}

export const transferQueueProvider = new TransferQueueProvider();
