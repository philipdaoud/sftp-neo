import { refreshRemoteExplorer } from '../shared';
import createFileHandler, { FileHandlerContext } from '../createFileHandler';
import {
  transfer,
  sync,
  planSync,
  executeSyncPlan,
  TransferOption,
  SyncOption,
  TransferDirection,
} from './transfer';
import { showSyncPreview } from './syncPreview';
import { showInformationMessage } from '../../host';
import { runHook } from '../../modules/hooks';
import { remoteBackupsProvider } from '../../modules/remoteBackups';
import { isConnectionError, withRetry } from '../../helper';
import logger from '../../logger';

const TRANSFER_RETRY_ATTEMPTS = 3;

function createTransferHandle(direction: TransferDirection) {
  return async function handle(this: FileHandlerContext, option) {
    const localFs = this.fileService.getLocalFileSystem();
    const { localFsPath, remoteFsPath } = this.target;
    const hooks = this.config.hooks;
    const hookCtx = {
      localPath: localFsPath,
      remotePath: remoteFsPath,
      host: this.config.host,
      protocol: this.config.protocol,
    };
    const workspacePath = this.fileService.workspace;

    const isUpload = direction === TransferDirection.LOCAL_TO_REMOTE;
    const preHook = isUpload ? 'preUpload' : 'preDownload';
    const postHook = isUpload ? 'postUpload' : 'postDownload';

    await runHook(preHook, hooks, hookCtx, workspacePath);

    await withRetry(
      async () => {
        const remoteFs = await this.fileService.getRemoteFileSystem(this.config);
        const scheduler = this.fileService.createTransferScheduler(this.config.concurrency);
        let transferConfig;
        if (direction === TransferDirection.REMOTE_TO_LOCAL) {
          transferConfig = {
            srcFsPath: remoteFsPath,
            srcFs: remoteFs,
            targetFsPath: localFsPath,
            targetFs: localFs,
            transferOption: option,
            transferDirection: TransferDirection.REMOTE_TO_LOCAL,
          };
        } else {
          transferConfig = {
            srcFsPath: localFsPath,
            srcFs: localFs,
            targetFsPath: remoteFsPath,
            targetFs: remoteFs,
            transferOption: option,
            filePerm: this.config.filePerm,
            dirPerm: this.config.dirPerm,
            transferDirection: TransferDirection.LOCAL_TO_REMOTE,
          };
        }
        // todo: abort at here. we should stop collect task
        await transfer(transferConfig, t => scheduler.add(t));
        await scheduler.run();

        if (isUpload) {
          remoteBackupsProvider.refresh();
        }
      },
      {
        maxAttempts: TRANSFER_RETRY_ATTEMPTS,
        shouldRetry: isConnectionError,
        onRetry: (err, attempt) => {
          logger.info(`Connection lost during transfer (attempt ${attempt}/${TRANSFER_RETRY_ATTEMPTS - 1}). Reconnecting...`);
          this.fileService.clearRemoteFileSystem(this.config);
        },
      }
    );

    await runHook(postHook, hooks, hookCtx, workspacePath);
  };
}

/**
 * Run a sync, showing Preview Sync first when `option.preview` asks for it.
 * Resolves `false` when the user dismissed the preview and nothing ran.
 */
async function runSync(
  this: FileHandlerContext,
  option: SyncOption,
  direction: TransferDirection
): Promise<boolean> {
  const localFs = this.fileService.getLocalFileSystem();
  const { localFsPath, remoteFsPath } = this.target;
  const retryOption = {
    maxAttempts: TRANSFER_RETRY_ATTEMPTS,
    shouldRetry: isConnectionError,
    onRetry: (err, attempt) => {
      logger.info(`Connection lost during transfer (attempt ${attempt}/${TRANSFER_RETRY_ATTEMPTS - 1}). Reconnecting...`);
      this.fileService.clearRemoteFileSystem(this.config);
    },
  };
  const syncConfig = remoteFs =>
    direction === TransferDirection.LOCAL_TO_REMOTE
      ? {
          srcFsPath: localFsPath,
          srcFs: localFs,
          targetFsPath: remoteFsPath,
          targetFs: remoteFs,
          transferOption: option,
          transferDirection: direction,
        }
      : {
          srcFsPath: remoteFsPath,
          srcFs: remoteFs,
          targetFsPath: localFsPath,
          targetFs: localFs,
          transferOption: option,
          transferDirection: direction,
        };

  const preview = option.preview || 'never';
  if (preview === 'never') {
    await withRetry(async () => {
      const remoteFs = await this.fileService.getRemoteFileSystem(this.config);
      const scheduler = this.fileService.createTransferScheduler(this.config.concurrency);
      await sync(syncConfig(remoteFs), t => scheduler.add(t));
      await scheduler.run();
    }, retryOption);
    return true;
  }

  let planFs;
  let plan;
  await withRetry(async () => {
    planFs = await this.fileService.getRemoteFileSystem(this.config);
    plan = await planSync(syncConfig(planFs));
  }, retryOption);

  if (!plan.transfers.length && !plan.deletions.length && !plan.folders.length) {
    if (preview === 'always') {
      showInformationMessage('Everything is already in sync.');
    }
    return true;
  }

  let keep = (_key: string) => true;
  if (preview === 'always' || plan.deletions.length) {
    const keys = await showSyncPreview(plan, { localRoot: localFsPath, remoteRoot: remoteFsPath });
    if (!keys) {
      logger.info('Sync cancelled from Preview Sync.');
      return false;
    }
    keep = key => keys.has(key);
  }

  await withRetry(async () => {
    const remoteFs = await this.fileService.getRemoteFileSystem(this.config);
    const scheduler = this.fileService.createTransferScheduler(this.config.concurrency);
    const config = syncConfig(remoteFs);
    // Planned tasks are bound to the connection they were planned on; after a
    // reconnect, plan again and apply the same selection.
    const current = remoteFs === planFs ? plan : await planSync(config);
    await executeSyncPlan(current, keep, config, t => scheduler.add(t));
    await scheduler.run();
  }, retryOption);
  return true;
}

const uploadHandle = createTransferHandle(TransferDirection.LOCAL_TO_REMOTE);
const downloadHandle = createTransferHandle(TransferDirection.REMOTE_TO_LOCAL);

export const sync2Remote = createFileHandler<SyncOption>({
  name: 'sync local ➞ remote',
  async handle(option) {
    const { localFsPath, remoteFsPath } = this.target;
    const hooks = this.config.hooks;
    const hookCtx = {
      localPath: localFsPath,
      remotePath: remoteFsPath,
      host: this.config.host,
      protocol: this.config.protocol,
    };
    const workspacePath = this.fileService.workspace;

    await runHook('preSync', hooks, hookCtx, workspacePath);

    // Attach filePerm and dirPerm to transferOption
    option.filePerm = this.config.filePerm;
    option.dirPerm = this.config.dirPerm;

    const ran = await runSync.call(this, option, TransferDirection.LOCAL_TO_REMOTE);
    if (!ran) {
      return;
    }
    remoteBackupsProvider.refresh();

    await runHook('postSync', hooks, hookCtx, workspacePath);
  },
  transformOption() {
    const config = this.config;
    const syncOption = config.syncOption || {};
    return {
      perserveTargetMode: config.protocol === 'sftp' && !config.filePerm && !config.dirPerm,
      useTempFile: config.useTempFile,
      openSsh: config.openSsh,
      // remoteTimeOffsetInHours: config.remoteTimeOffsetInHours,
      ignore: config.ignore,
      delete: syncOption.delete,
      skipCreate: syncOption.skipCreate,
      ignoreExisting: syncOption.ignoreExisting,
      update: syncOption.update,
      preview: syncOption.preview || 'onDelete',
      backup: config.backup,
      remotePath: config.remotePath,
      localBasePath: this.fileService.baseDir,
    };
  },
  afterHandle() {
    refreshRemoteExplorer(this.target, true);
  },
});

export const sync2Local = createFileHandler<SyncOption>({
  name: 'sync remote ➞ local',
  async handle(option) {
    const { localFsPath, remoteFsPath } = this.target;
    const hooks = this.config.hooks;
    const hookCtx = {
      localPath: localFsPath,
      remotePath: remoteFsPath,
      host: this.config.host,
      protocol: this.config.protocol,
    };
    const workspacePath = this.fileService.workspace;

    await runHook('preSync', hooks, hookCtx, workspacePath);

    const ran = await runSync.call(this, option, TransferDirection.REMOTE_TO_LOCAL);
    if (!ran) {
      return;
    }

    await runHook('postSync', hooks, hookCtx, workspacePath);
  },
  transformOption() {
    const config = this.config;
    const syncOption = config.syncOption || {};
    return {
      perserveTargetMode: false,
      // remoteTimeOffsetInHours: config.remoteTimeOffsetInHours,
      ignore: config.ignore,
      delete: syncOption.delete,
      skipCreate: syncOption.skipCreate,
      ignoreExisting: syncOption.ignoreExisting,
      update: syncOption.update,
      preview: syncOption.preview || 'onDelete',
    };
  },
});

export const upload = createFileHandler<TransferOption>({
  name: 'upload',
  handle: uploadHandle,
  transformOption() {
    const config = this.config;
    return {
      perserveTargetMode: config.protocol === 'sftp' && !config.filePerm && !config.dirPerm,
      useTempFile: config.useTempFile,
      openSsh: config.openSsh,
      // remoteTimeOffsetInHours: config.remoteTimeOffsetInHours,
      ignore: config.ignore,
      backup: config.backup,
      remotePath: config.remotePath,
      localBasePath: this.fileService.baseDir,
    };
  },
  afterHandle() {
    refreshRemoteExplorer(this.target, this.fileService);
  },
});

export const uploadFile = createFileHandler<TransferOption>({
  name: 'upload file',
  handle: uploadHandle,
  transformOption() {
    const config = this.config;
    return {
      perserveTargetMode: config.protocol === 'sftp' && !config.filePerm,
      useTempFile: config.useTempFile,
      openSsh: config.openSsh,
      // remoteTimeOffsetInHours: config.remoteTimeOffsetInHours,
      ignore: config.ignore,
      backup: config.backup,
      remotePath: config.remotePath,
      localBasePath: this.fileService.baseDir,
    };
  },
  afterHandle() {
    refreshRemoteExplorer(this.target, false);
  },
});

export const uploadFolder = createFileHandler<TransferOption>({
  name: 'upload folder',
  handle: uploadHandle,
  transformOption() {
    const config = this.config;
    return {
      perserveTargetMode: config.protocol === 'sftp' && !config.dirPerm,
      useTempFile: config.useTempFile,
      openSsh: config.openSsh,
      // remoteTimeOffsetInHours: config.remoteTimeOffsetInHours,
      ignore: config.ignore,
      backup: config.backup,
      remotePath: config.remotePath,
      localBasePath: this.fileService.baseDir,
    };
  },
  afterHandle() {
    refreshRemoteExplorer(this.target, true);
  },
});

export const download = createFileHandler<TransferOption>({
  name: 'download',
  handle: downloadHandle,
  transformOption() {
    const config = this.config;
    return {
      perserveTargetMode: false,
      // remoteTimeOffsetInHours: config.remoteTimeOffsetInHours,
      ignore: config.ignore,
    };
  },
});

export const downloadFile = createFileHandler<TransferOption>({
  name: 'download file',
  handle: downloadHandle,
  transformOption() {
    const config = this.config;
    return {
      perserveTargetMode: false,
      // remoteTimeOffsetInHours: config.remoteTimeOffsetInHours,
      ignore: config.ignore,
    };
  },
});

export const downloadFolder = createFileHandler<TransferOption>({
  name: 'download folder',
  handle: downloadHandle,
  transformOption() {
    const config = this.config;
    return {
      perserveTargetMode: false,
      // remoteTimeOffsetInHours: config.remoteTimeOffsetInHours,
      ignore: config.ignore,
    };
  },
});
