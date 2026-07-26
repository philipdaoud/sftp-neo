'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import app from './app';
import initCommands from './initCommands';
import { reportError } from './helper';
import fileActivityMonitor from './modules/fileActivityMonitor';
import { tryLoadConfigs } from './modules/config';
import { getAllFileService, createFileService, disposeFileService } from './modules/serviceManager';
import { getWorkspaceFolders, setContextValue } from './host';
import RemoteExplorer from './modules/remoteExplorer';
import { initSecrets } from './modules/secrets';
import { transferQueueProvider } from './modules/transferQueue';
import { remoteBackupsProvider, backupContentProvider, BACKUP_SCHEME } from './modules/remoteBackups';
import { registerCommand } from './host';
import {
  COMMAND_TRANSFER_QUEUE_CANCEL,
  COMMAND_TRANSFER_QUEUE_CLEAR,
} from './constants';

async function setupWorkspaceFolder(dir) {
  const configs = await tryLoadConfigs(dir);
  configs.forEach(config => {
    createFileService(config, dir);
  });
}

function setup(workspaceFolders: readonly vscode.WorkspaceFolder[]) {
  fileActivityMonitor.init();
  const pendingInits = workspaceFolders.map(folder => setupWorkspaceFolder(folder.uri.fsPath));

  return Promise.all(pendingInits);
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  initSecrets(context);

  try {
    initCommands(context);
  } catch (error) {
    reportError(error, 'initCommands');
  }

  const workspaceFolders = getWorkspaceFolders();
  if (!workspaceFolders) {
    return;
  }

  setContextValue('enabled', true);
  app.sftpBarItem.show();
  // Note: AppState holds a single observer, so this must stay the only
  // subscribe call - a second one would silently replace this handler.
  app.state.subscribe(_ => {
    const currentText = app.sftpBarItem.getText();
    // current is showing profile
    if (currentText.startsWith('SFTP')) {
      app.sftpBarItem.reset();
    }
    if (app.remoteExplorer) {
      app.remoteExplorer.refresh();
    }

    // The watcher config is resolved per profile, so it has to be rebuilt.
    getAllFileService().forEach(fileService => {
      try {
        fileService.reloadWatcher();
      } catch (error) {
        // A profile that fails validation shouldn't stop the others.
        reportError(error, `reload watcher for ${fileService.name || fileService.baseDir}`);
      }
    });
  });
  try {
    await setup(workspaceFolders);
    setContextValue('hasConfig', getAllFileService().length > 0);
    app.remoteExplorer = new RemoteExplorer(context);

    context.subscriptions.push(
      vscode.window.registerTreeDataProvider('transferQueue', transferQueueProvider)
    );

    context.subscriptions.push(
      vscode.window.registerTreeDataProvider('remoteBackups', remoteBackupsProvider)
    );

    const remoteBackupsView = vscode.window.createTreeView('remoteBackups', {
      treeDataProvider: remoteBackupsProvider,
    });
    remoteBackupsProvider.setTreeView(remoteBackupsView);
    context.subscriptions.push(remoteBackupsView);

    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider(BACKUP_SCHEME, backupContentProvider)
    );

    context.subscriptions.push(
      app.remoteExplorer.onDidChangeSelection(event => {
        const selectedFile = event.selection.find(item => !item.isDirectory);
        if (selectedFile) {
          remoteBackupsProvider.setSelectedFile(selectedFile.resource.remoteId, selectedFile.resource.fsPath);
        } else {
          remoteBackupsProvider.clearSelectedFile();
        }
      })
    );

    registerCommand(context, COMMAND_TRANSFER_QUEUE_CANCEL, (item: any) => {
      if (item && item.id) {
        transferQueueProvider.cancel(item.id);
      }
    });

    registerCommand(context, COMMAND_TRANSFER_QUEUE_CLEAR, () => {
      transferQueueProvider.clearCompleted();
    });
  } catch (error) {
    reportError(error);
  }
}

export function deactivate() {
  fileActivityMonitor.destory();
  getAllFileService().forEach(disposeFileService);
}
