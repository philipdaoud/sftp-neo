import * as vscode from 'vscode';
import logger from '../logger';
import { realpathSync } from 'fs';
import app from '../app';
import StatusBarItem from '../ui/statusBarItem';
import {
  onDidOpenTextDocument,
  onDidRenameFiles,
  onDidSaveTextDocument,
  onWillRenameFiles,
  onWillSaveTextDocument,
  showConfirmMessage,
} from '../host';
import { readConfigsFromFile } from './config';
import {
  createFileService,
  getFileService,
  findAllFileService,
  disposeFileService,
} from './serviceManager';
import { reportError, isValidFile, isConfigFile, isInWorkspace } from '../helper';
import { downloadFile, renameRemote, upload, uploadFile } from '../fileHandlers';
import {
  SAVE_SUPPRESSION_TTL,
  releaseWatcherSuppression,
  suppressWatcherFor,
} from './watcherSuppression';

let workspaceWatcher: vscode.Disposable;
let willRenameWatcher: vscode.Disposable;
let didRenameWatcher: vscode.Disposable;
let willSaveWatcher: vscode.Disposable;

async function handleConfigSave(uri: vscode.Uri) {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
  if (!workspaceFolder) {
    return;
  }

  const workspacePath = workspaceFolder.uri.fsPath;

  // dispose old service
  findAllFileService(service => service.workspace === workspacePath).forEach(disposeFileService);

  // create new service
  try {
    const configs = await readConfigsFromFile(uri.fsPath);
    configs.forEach(config => createFileService(config, workspacePath));
  } catch (error) {
    reportError(error);
  } finally {
    app.remoteExplorer.refresh();
  }
}

async function handleFileSave(uri: vscode.Uri) {
  const fileService = getFileService(uri);
  if (!fileService) {
    return;
  }

  const config = fileService.getConfig();
  if (config.uploadOnSave) {
    const fspath = await realpathSync.native(uri.fsPath);
    uri = vscode.Uri.file(fspath);
    logger.info(`[file-save] ${fspath}`);
    try {
      await uploadFile(uri);
    } catch (error) {
      logger.error(error, `download ${fspath}`);
      app.sftpBarItem.updateStatus(StatusBarItem.Status.error);
    }
  }
}

/**
 * Claim a path just before VS Code writes it, so the watcher's change event for
 * that write is dropped and `uploadOnSave` stays the only thing that uploads.
 *
 * Runs on `onWillSaveTextDocument`, which fires before the bytes hit disk, so
 * the claim is always in place before the watcher can see anything. Writes made
 * outside the editor never reach this event, so those keep uploading through
 * the watcher as normal.
 */
function suppressWatcherForSave(doc: vscode.TextDocument) {
  const uri = doc.uri;
  if (!isValidFile(uri) || !isInWorkspace(uri.fsPath) || isConfigFile(uri)) {
    return;
  }

  const fileService = getFileService(uri);
  if (!fileService) {
    return;
  }

  let config;
  try {
    config = fileService.getConfig();
  } catch (error) {
    // A profile that fails validation must not get in the way of saving.
    return;
  }

  // Only when the save itself will upload. Suppressing while `uploadOnSave` is
  // off would leave nothing to upload the file and silently break Ctrl+S.
  if (!config.uploadOnSave) {
    return;
  }

  // Nothing to suppress if the watcher isn't uploading in the first place.
  if (!config.watcher || !config.watcher.autoUpload) {
    return;
  }

  if (config.ignore && config.ignore(uri.fsPath)) {
    return;
  }

  logger.trace(`[file-will-save] claiming ${uri.fsPath} for uploadOnSave`);
  suppressWatcherFor(uri.fsPath, SAVE_SUPPRESSION_TTL);

  // handleFileSave uploads the resolved real path, and the watcher may report
  // either spelling for a symlinked file.
  try {
    const realPath = realpathSync.native(uri.fsPath);
    if (realPath !== uri.fsPath) {
      suppressWatcherFor(realPath, SAVE_SUPPRESSION_TTL);
    }
  } catch (error) {
    // Not on disk yet; the plain path is all there is to claim.
  }
}

async function downloadOnOpen(uri: vscode.Uri) {
  const fileService = getFileService(uri);
  if (!fileService) {
    return;
  }

  const config = fileService.getConfig();
  if (config.downloadOnOpen) {
    if (config.downloadOnOpen === 'confirm') {
      const isConfirm = await showConfirmMessage('Do you want SFTP to download this file?');
      if (!isConfirm) return;
    }

    const fspath = uri.fsPath;
    logger.info(`[file-open] ${fspath}`);
    try {
      await downloadFile(uri);
    } catch (error) {
      logger.error(error, `download ${fspath}`);
      app.sftpBarItem.updateStatus(StatusBarItem.Status.error);
    }
  }
}

function autoRenameEnabled(fileService: ReturnType<typeof getFileService>) {
  if (!fileService) {
    return false;
  }

  const { watcher } = fileService.getConfig();
  return Boolean(watcher && watcher.autoRename);
}

/**
 * Runs before the files move on disk, so the watcher can never observe the
 * rename as a delete + create before we have claimed those paths.
 */
function suppressWatcherForRename(e: vscode.FileWillRenameEvent) {
  for (const { oldUri, newUri } of e.files) {
    if (!isValidFile(oldUri) || !autoRenameEnabled(getFileService(oldUri))) {
      continue;
    }

    suppressWatcherFor(oldUri.fsPath);
    suppressWatcherFor(newUri.fsPath);
  }
}

async function handleFileRename(e: vscode.FileRenameEvent) {
  for (const { oldUri, newUri } of e.files) {
    if (!isValidFile(oldUri) || !isInWorkspace(oldUri.fsPath)) {
      continue;
    }

    const fileService = getFileService(oldUri);
    if (!autoRenameEnabled(fileService)) {
      continue;
    }

    const config = fileService.getConfig();

    // Moving between two different configs isn't a server-side rename, so hand
    // it back to the normal upload/delete path.
    if (getFileService(newUri) !== fileService) {
      logger.info(`[file-rename] skipped (crosses config boundary) ${oldUri.fsPath}`);
      releaseWatcherSuppression(oldUri.fsPath);
      releaseWatcherSuppression(newUri.fsPath);
      continue;
    }

    if (config.ignore && (config.ignore(oldUri.fsPath) || config.ignore(newUri.fsPath))) {
      releaseWatcherSuppression(oldUri.fsPath);
      releaseWatcherSuppression(newUri.fsPath);
      continue;
    }

    // The suppression was sized for the watcher's debounce, not for however
    // long the server takes. Extend it so late events still get dropped.
    suppressWatcherFor(oldUri.fsPath);
    suppressWatcherFor(newUri.fsPath);

    logger.info(`[file-rename] ${oldUri.fsPath} ➞ ${newUri.fsPath}`);
    try {
      await renameRemote(oldUri, { newLocalPath: newUri.fsPath });
    } catch (error) {
      logger.error(error, `rename ${oldUri.fsPath}`);

      // The rename didn't happen, so nothing is holding the new path on the
      // server. Most often the source was never uploaded in the first place,
      // and a plain upload is the right answer.
      releaseWatcherSuppression(newUri.fsPath);
      if (config.watcher && config.watcher.autoUpload) {
        try {
          await upload(newUri);
        } catch (uploadError) {
          logger.error(uploadError, `upload ${newUri.fsPath}`);
          app.sftpBarItem.updateStatus(StatusBarItem.Status.error);
        }
      } else {
        app.sftpBarItem.updateStatus(StatusBarItem.Status.error);
      }
    }
  }
}

function watchWorkspace({
  onDidSaveFile,
  onDidSaveSftpConfig,
}: {
  onDidSaveFile: (uri: vscode.Uri) => void;
  onDidSaveSftpConfig: (uri: vscode.Uri) => void;
}) {
  if (workspaceWatcher) {
    workspaceWatcher.dispose();
  }

  workspaceWatcher = onDidSaveTextDocument((doc: vscode.TextDocument) => {
    const uri = doc.uri;
    if (!isValidFile(uri) || !isInWorkspace(uri.fsPath)) {
      return;
    }

    // remove staled cache
    if (app.fsCache.has(uri.fsPath)) {
      app.fsCache.delete(uri.fsPath);
    }

    if (isConfigFile(uri)) {
      onDidSaveSftpConfig(uri);
      return;
    }

    onDidSaveFile(uri);
  });
}

function init() {
  onDidOpenTextDocument((doc: vscode.TextDocument) => {
    if (!isValidFile(doc.uri) || !isInWorkspace(doc.uri.fsPath)) {
      return;
    }

    downloadOnOpen(doc.uri);
  });

  watchWorkspace({
    onDidSaveFile: handleFileSave,
    onDidSaveSftpConfig: handleConfigSave,
  });

  willSaveWatcher = onWillSaveTextDocument(e => suppressWatcherForSave(e.document));

  willRenameWatcher = onWillRenameFiles(suppressWatcherForRename);
  didRenameWatcher = onDidRenameFiles(e => {
    // VS Code doesn't await this event, so nothing else will catch a rejection.
    handleFileRename(e).catch(error => reportError(error));
  });
}

function destory() {
  if (workspaceWatcher) {
    workspaceWatcher.dispose();
  }

  if (willSaveWatcher) {
    willSaveWatcher.dispose();
  }

  if (willRenameWatcher) {
    willRenameWatcher.dispose();
  }

  if (didRenameWatcher) {
    didRenameWatcher.dispose();
  }
}

export default {
  init,
  destory,
};
