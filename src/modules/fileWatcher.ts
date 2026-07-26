import * as vscode from 'vscode';
import debounce from 'lodash.debounce';
import logger from '../logger';
import { isValidFile, fileDepth } from '../helper';
import { upload, removeRemote } from '../fileHandlers';
import { WatcherService, TransferDirection } from '../core';
import app from '../app';
import StatusBarItem from '../ui/statusBarItem';
import { getRunningTransformTasks } from './serviceManager';
import { isWatcherSuppressed } from './watcherSuppression';

const watchers: {
  [x: string]: vscode.FileSystemWatcher;
} = {};

// Keyed by fsPath, not by Uri: every watcher event carries a fresh Uri object,
// so a Set would compare by reference and queue the same file more than once.
const uploadQueue = new Map<string, vscode.Uri>();
const deleteQueue = new Map<string, vscode.Uri>();

// less than 550 will not work
const ACTION_INTEVAL = 550;

function doUpload() {
  const files = Array.from(uploadQueue.values()).sort(
    (a, b) => fileDepth(b.fsPath) - fileDepth(a.fsPath)
  );
  uploadQueue.clear();

  const currentDownloadTasks = getRunningTransformTasks().filter(
    task => task.transferType === TransferDirection.REMOTE_TO_LOCAL
  );

  files.forEach(async uri => {
    // current target is still in downloading, so don't upload it.
    if (currentDownloadTasks.find(task => task.localFsPath === uri.fsPath)) {
      return;
    }

    const fspath = uri.fsPath;
    logger.info(`[watcher/updated] ${fspath}`);
    try {
      await upload(uri);
    } catch (error) {
      logger.error(error, `upload ${fspath}`);
      app.sftpBarItem.updateStatus(StatusBarItem.Status.error);
    }
  });
}

function doDelete() {
  const files = Array.from(deleteQueue.values()).sort(
    (a, b) => fileDepth(b.fsPath) - fileDepth(a.fsPath)
  );
  deleteQueue.clear();
  files.forEach(async uri => {
    const fspath = uri.fsPath;
    logger.info(`[watcher/removed] ${fspath}`);
    try {
      await removeRemote(uri);
    } catch (error) {
      logger.error(error, `remove ${fspath}`);
      app.sftpBarItem.updateStatus(StatusBarItem.Status.error);
    }
  });
}

const debouncedUpload = debounce(doUpload, ACTION_INTEVAL, { leading: true, trailing: true });
const debouncedDelete = debounce(doDelete, ACTION_INTEVAL, { leading: true, trailing: true });

function uploadHandler(uri: vscode.Uri, ignore?: (fsPath: string) => boolean) {
  if (!isValidFile(uri)) {
    return;
  }

  if (ignore && ignore(uri.fsPath)) {
    return;
  }

  // Either a rename is already moving this path on the server, or uploadOnSave
  // is about to upload it. Both would turn into a redundant second upload.
  if (isWatcherSuppressed(uri.fsPath)) {
    logger.trace(`[watcher/updated] skipped (handled elsewhere) ${uri.fsPath}`);
    return;
  }

  uploadQueue.set(uri.fsPath, uri);
  debouncedUpload();
}

function addWatcher(id, watcher) {
  watchers[id] = watcher;
}

function getWatcher(id) {
  return watchers[id];
}

function createWatcher(
  watcherBase: string,
  watcherConfig: { files: false | string; autoUpload: boolean; autoDelete: boolean },
  ignore?: (fsPath: string) => boolean
) {
  // Clear any old watcher. Drop it from the table too: switching to a profile
  // that disables watching returns early below, and a disposed watcher left
  // behind would be handed out again on the next lookup.
  removeWatcher(watcherBase);

  if (!watcherConfig) {
    return;
  }

  const shouldAddListenser = watcherConfig.autoUpload || watcherConfig.autoDelete;
  // tslint:disable-next-line triple-equals
  if (watcherConfig.files == false || !shouldAddListenser) {
    return;
  }

  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(watcherBase, watcherConfig.files),
    false,
    false,
    false
  );
  addWatcher(watcherBase, watcher);

  if (watcherConfig.autoUpload) {
    watcher.onDidCreate(uri => uploadHandler(uri, ignore));
    watcher.onDidChange(uri => uploadHandler(uri, ignore));
  }

  if (watcherConfig.autoDelete) {
    watcher.onDidDelete(uri => {
      if (!isValidFile(uri)) {
        return;
      }

      if (ignore && ignore(uri.fsPath)) {
        return;
      }

      // The old path of a rename shows up here as a plain delete. Acting on it
      // would recursively remove the remote folder the rename is about to move
      // (or has already moved), destroying any remote-only files inside it.
      if (isWatcherSuppressed(uri.fsPath)) {
        logger.trace(`[watcher/removed] skipped (handled elsewhere) ${uri.fsPath}`);
        return;
      }

      deleteQueue.set(uri.fsPath, uri);
      debouncedDelete();
    });
  }
}

function removeWatcher(watcherBase: string) {
  const watcher = getWatcher(watcherBase);
  if (watcher) {
    watcher.dispose();
    delete watchers[watcherBase];
  }
}

const watcherService: WatcherService = {
  create: createWatcher,
  dispose: removeWatcher,
};

export default watcherService;
