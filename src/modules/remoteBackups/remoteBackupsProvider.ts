import * as vscode from 'vscode';
import * as path from 'path';
import upath from '../../core/upath';
import { FileSystem, FileType, FileEntry } from '../../core/fs';
import { getBackupFolder, parseBackupPath } from '../../core/backup';
import localFs from '../../core/localFs';
import { getAllFileService } from '../serviceManager';
import { BackupVersion, BackupItem } from './backupItem';
import logger from '../../logger';

function formatBackupLabel(date: Date, size?: number): string {
  const localeDate = date.toLocaleString();
  if (size === undefined) {
    return localeDate;
  }
  return `${localeDate} (${formatBytes(size)})`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

async function listBackupEntriesRecursive(fs: FileSystem, dir: string): Promise<FileEntry[]> {
  let entries: FileEntry[] = [];
  let dirEntries: FileEntry[];
  try {
    dirEntries = await fs.list(dir);
  } catch (error) {
    return [];
  }

  for (const entry of dirEntries) {
    if (entry.type === FileType.Directory) {
      const childEntries = await listBackupEntriesRecursive(fs, entry.fspath);
      entries = entries.concat(childEntries);
    } else if (entry.type === FileType.File) {
      entries.push(entry);
    }
  }

  return entries;
}

interface SelectedFile {
  fileServiceId: number;
  originalPath: string;
}

export class RemoteBackupsProvider implements vscode.TreeDataProvider<BackupItem> {
  private _treeView: vscode.TreeView<BackupItem> | undefined;
  private _selectedFile: SelectedFile | null = null;
  private _onDidChangeTreeData: vscode.EventEmitter<BackupItem | undefined> = new vscode.EventEmitter<
    BackupItem | undefined
  >();
  readonly onDidChangeTreeData: vscode.Event<BackupItem | undefined> = this._onDidChangeTreeData.event;

  setTreeView(treeView: vscode.TreeView<BackupItem>): void {
    this._treeView = treeView;
  }

  private _updateTitle(location?: 'local' | 'remote'): void {
    if (!this._treeView) {
      return;
    }
    if (location === 'local') {
      this._treeView.title = 'Local Backups';
    } else if (location === 'remote') {
      this._treeView.title = 'Remote Backups';
    } else {
      this._treeView.title = 'Backups';
    }
  }

  getTreeItem(item: BackupItem): vscode.TreeItem {
    const version = item as BackupVersion;
    return {
      label: formatBackupLabel(version.timestamp, version.size),
      tooltip: `Backup path: ${version.backupPath}\nOriginal path: ${version.originalPath}\nTimestamp: ${version.timestamp.toISOString()}`,
      iconPath: new vscode.ThemeIcon('history'),
      contextValue: 'backupVersion',
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      command: {
        command: 'sftp.remoteBackups.open',
        arguments: [version],
        title: 'Open Backup',
      },
    };
  }

  async getChildren(_element?: BackupItem): Promise<BackupItem[]> {
    if (!this._selectedFile) {
      return [];
    }

    return this._loadBackupsForFile(this._selectedFile);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  setSelectedFile(fileServiceId: number, originalPath: string): void {
    if (
      this._selectedFile &&
      this._selectedFile.fileServiceId === fileServiceId &&
      this._selectedFile.originalPath === originalPath
    ) {
      return;
    }

    this._selectedFile = { fileServiceId, originalPath };
    this._updateTitleFromSelectedFile();
    this.refresh();
  }

  clearSelectedFile(): void {
    if (!this._selectedFile) {
      return;
    }

    this._selectedFile = null;
    this._updateTitle();
    this.refresh();
  }

  private _updateTitleFromSelectedFile(): void {
    const selected = this._selectedFile;
    if (!selected) {
      this._updateTitle();
      return;
    }

    const fileService = getAllFileService().find(service => service.id === selected.fileServiceId);
    if (!fileService) {
      this._updateTitle();
      return;
    }

    const config = fileService.getConfig();
    const location = config.backup?.location || 'remote';
    this._updateTitle(location);
  }

  private async _loadBackupsForFile(selected: SelectedFile): Promise<BackupVersion[]> {
    const fileService = getAllFileService().find(service => service.id === selected.fileServiceId);
    if (!fileService) {
      return [];
    }

    const config = fileService.getConfig();
    if (!config.backup || !config.backup.enabled || config.backup.versions <= 0) {
      return [];
    }

    const location = config.backup.location || 'remote';
    this._updateTitle(location);

    let backupFs: FileSystem;
    let backupRoot: string;
    let pathResolver: typeof path | typeof upath;

    if (location === 'local') {
      backupFs = localFs;
      backupRoot = path.join(fileService.baseDir, config.backup.folder);
      pathResolver = path;
    } else {
      try {
        backupFs = await fileService.getRemoteFileSystem(config);
      } catch (error) {
        logger.warn(`backups: failed to connect to ${fileService.name}: ${error.message}`);
        return [];
      }
      backupRoot = getBackupFolder(config.remotePath, config.backup.folder);
      pathResolver = upath;
    }

    let entries: FileEntry[];
    try {
      entries = await listBackupEntriesRecursive(backupFs, backupRoot);
    } catch (error) {
      logger.warn(`backups: failed to list ${backupRoot}: ${error.message}`);
      return [];
    }

    const versions: BackupVersion[] = [];
    for (const entry of entries) {
      const info = parseBackupPath(entry.fspath, config.backup.folder, config.remotePath, backupRoot, pathResolver);
      if (!info || info.originalPath !== selected.originalPath) {
        continue;
      }

      versions.push({
        fileService,
        backupPath: entry.fspath,
        originalPath: info.originalPath,
        timestamp: info.timestamp,
        size: entry.size,
        location,
      });
    }

    return versions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}

export const remoteBackupsProvider = new RemoteBackupsProvider();
