import { refreshRemoteExplorer } from '../shared';
import createFileHandler, { FileHandlerContext } from '../createFileHandler';
import { transfer, sync, TransferOption, SyncOption, TransferDirection } from './transfer';
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

const uploadHandle = createTransferHandle(TransferDirection.LOCAL_TO_REMOTE);
const downloadHandle = createTransferHandle(TransferDirection.REMOTE_TO_LOCAL);

export const sync2Remote = createFileHandler<SyncOption>({
  name: 'sync local ➞ remote',
  async handle(option) {
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

    await runHook('preSync', hooks, hookCtx, workspacePath);

    // Attach filePerm and dirPerm to transferOption
    option.filePerm = this.config.filePerm;
    option.dirPerm = this.config.dirPerm;

    await withRetry(
      async () => {
        const remoteFs = await this.fileService.getRemoteFileSystem(this.config);
        const scheduler = this.fileService.createTransferScheduler(this.config.concurrency);
        await sync(
          {
            srcFsPath: localFsPath,
            srcFs: localFs,
            targetFsPath: remoteFsPath,
            targetFs: remoteFs,
            transferOption: option,
            transferDirection: TransferDirection.LOCAL_TO_REMOTE,
          },
          t => scheduler.add(t)
        );
        await scheduler.run();

        remoteBackupsProvider.refresh();
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

    await runHook('preSync', hooks, hookCtx, workspacePath);

    await withRetry(
      async () => {
        const remoteFs = await this.fileService.getRemoteFileSystem(this.config);
        const scheduler = this.fileService.createTransferScheduler(this.config.concurrency);
        await sync(
          {
            srcFsPath: remoteFsPath,
            srcFs: remoteFs,
            targetFsPath: localFsPath,
            targetFs: localFs,
            transferOption: option,
            transferDirection: TransferDirection.REMOTE_TO_LOCAL,
          },
          t => scheduler.add(t)
        );
        await scheduler.run();
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
