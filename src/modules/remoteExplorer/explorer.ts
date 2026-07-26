import * as vscode from 'vscode';
import { registerCommand, setContextValue } from '../../host';
import {
  COMMAND_REMOTEEXPLORER_REFRESH,
  COMMAND_REMOTEEXPLORER_VIEW_CONTENT,
  VIEW_REMOTE_EXPLORER,
} from '../../constants';
import { UResource } from '../../core';
import { toRemotePath } from '../../helper';
import { REMOTE_SCHEME } from '../../constants';
import { getFileService } from '../serviceManager';
import RemoteTreeDataProvider, { ExplorerItem } from './treeDataProvider';
import RemoteExplorerDragAndDropController from './dragAndDrop';

export default class RemoteExplorer {
  private _explorerView: vscode.TreeView<ExplorerItem>;
  private _treeDataProvider: RemoteTreeDataProvider;

  constructor(context: vscode.ExtensionContext) {
    this._treeDataProvider = new RemoteTreeDataProvider();
    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider(REMOTE_SCHEME, this._treeDataProvider)
    );

    // The controller is always attached; it no-ops for any config that hasn't
    // opted in via remoteExplorer.enableDragAndDrop, which is per-config.
    this._explorerView = vscode.window.createTreeView(VIEW_REMOTE_EXPLORER, {
      showCollapseAll: true,
      treeDataProvider: this._treeDataProvider,
      canSelectMany: true,
      dragAndDropController: new RemoteExplorerDragAndDropController(this._treeDataProvider),
    });

    registerCommand(context, COMMAND_REMOTEEXPLORER_REFRESH, () => this._refreshSelection());
    registerCommand(context, COMMAND_REMOTEEXPLORER_VIEW_CONTENT, (item: ExplorerItem) =>
      this._treeDataProvider.showItem(item)
    );

    setContextValue('hasRemoteFilter', false);
  }

  refresh(item?: ExplorerItem) {
    if (item && !UResource.isRemote(item.resource.uri)) {
      const uri = item.resource.uri;
      const fileService = getFileService(uri);
      if (!fileService) {
        if (uri.toString(true) == "file:///${command:sftp.sync.remoteToLocal}") {
          throw '';
        } else {
          throw new Error(`Config Not Found. (${uri.toString(true)})`);
        }
      }
      const config = fileService.getConfig();
      const localPath = item.resource.fsPath;
      const remotePath = toRemotePath(localPath, config.context, config.remotePath);
      item.resource = UResource.makeResource({
        remote: {
          host: config.host,
          port: config.port,
        },
        fsPath: remotePath,
        remoteId: fileService.id,
      });
    }

    this._treeDataProvider.refresh(item);
  }

  purge(remoteUri: vscode.Uri) {
    this._treeDataProvider.purge(remoteUri);
  }

  get onDidChangeSelection(): vscode.Event<vscode.TreeViewSelectionChangeEvent<ExplorerItem>> {
    return this._explorerView.onDidChangeSelection;
  }

  reveal(item: ExplorerItem): Thenable<void> {
    return item ? this._explorerView.reveal(item) : Promise.resolve();
  }

  findRoot(remoteUri: vscode.Uri) {
    return this._treeDataProvider.findRoot(remoteUri);
  }

  setFilter(query: string): void {
    this._treeDataProvider.setFilter(query);
    const normalizedQuery = query.toLowerCase().trim();
    setContextValue('hasRemoteFilter', Boolean(normalizedQuery));
    this._explorerView.description = normalizedQuery ? `Filter: ${normalizedQuery}` : undefined;
  }

  getFilter(): string {
    return this._treeDataProvider.getFilter();
  }

  private _refreshSelection() {
    if (this._explorerView.selection.length) {
      this._explorerView.selection.forEach(item => this.refresh(item));
    } else {
      this.refresh();
    }
  }
}
