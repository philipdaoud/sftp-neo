import * as path from 'path';
import { refreshRemoteExplorer } from './shared';
import { backup, fileOperations, FileType } from '../core';
import localFs from '../core/localFs';
import createFileHandler, { FileHandlerContext } from './createFileHandler';
import { FileHandleOption } from './option';
import { remoteBackupsProvider } from '../modules/remoteBackups';
import logger from '../logger';

/**
 * Copy everything the delete is about to destroy into the backup folder.
 *
 * Throws if any copy fails, so the caller never deletes on a partial backup.
 */
async function backupFilesBeingDeleted(
  ctx: FileHandlerContext,
  remoteFsPath: string
): Promise<number> {
  const config = ctx.config;
  if (!config.backup || !config.backup.enabled || !config.backup.onDelete) {
    return 0;
  }

  const remoteFs = await ctx.fileService.getRemoteFileSystem(config);

  let storage: backup.BackupStorage | undefined;
  if (config.backup.location === 'local') {
    storage = {
      fs: localFs,
      root: path.join(ctx.fileService.baseDir, config.backup.folder),
      pathResolver: path,
    };
  }

  return backup.backupBeforeDelete(
    remoteFsPath,
    remoteFs,
    config.backup,
    config.remotePath,
    storage
  );
}

export const removeRemote = createFileHandler<FileHandleOption & { skipDir?: boolean }>({
  name: 'removeRemote',
  async handle(option) {
    const remoteFs = await this.fileService.getRemoteFileSystem(this.config);
    const { remoteFsPath } = this.target;
    const stat = await remoteFs.lstat(remoteFsPath);

    if (stat.type === FileType.Directory && option.skipDir) {
      return;
    }

    // Deletes are irreversible, so this runs before anything is removed and
    // throws rather than letting the delete proceed on a partial backup.
    const backedUp = await backupFilesBeingDeleted(this, remoteFsPath);

    let promise;
    switch (stat.type) {
      case FileType.Directory:
        promise = fileOperations.removeDir(remoteFsPath, remoteFs, {});
        break;
      case FileType.File:
      case FileType.SymbolicLink:
        promise = fileOperations.removeFile(remoteFsPath, remoteFs, {});
        break;
      default:
        logger.warn(`Unsupported file type (type = ${stat.type}). File ${remoteFsPath}`);
    }
    await promise;

    if (backedUp > 0) {
      remoteBackupsProvider.refresh();
    }
  },
  transformOption() {
    const config = this.config;
    return {
      ignore: config.ignore,
    };
  },
  afterHandle() {
    refreshRemoteExplorer(this.target, false);
  },
});
