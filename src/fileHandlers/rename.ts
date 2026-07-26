import { fileOperations, upath } from '../core';
import { toRemotePath } from '../helper';
import createFileHandler from './createFileHandler';
import { refreshRemoteParent, purgeRemoteExplorerCache } from './shared';

interface RenameOption {
  // Destination given as a local fsPath. Translated to a remote path using the
  // service config, so callers driven by local events (git, file watcher) can
  // hand over the path they already have.
  newLocalPath?: string;

  // Destination given as an already-resolved remote path. Used as-is.
  newRemotePath?: string;
}

export const renameRemote = createFileHandler<RenameOption>({
  name: 'rename',
  async handle({ newLocalPath, newRemotePath }) {
    let dest: string;
    if (newRemotePath) {
      dest = newRemotePath;
    } else if (newLocalPath) {
      dest = toRemotePath(newLocalPath, this.fileService.baseDir, this.config.remotePath);
    } else {
      throw new Error('Rename needs a destination (newLocalPath or newRemotePath).');
    }

    const src = this.target.remoteFsPath;
    if (src === dest) {
      return;
    }

    const remoteFs = await this.fileService.getRemoteFileSystem(this.config);

    const srcParent = upath.dirname(src);
    const destParent = upath.dirname(dest);

    // Moving into a folder that was never uploaded would otherwise fail with a
    // bare "no such file".
    if (destParent !== srcParent) {
      await remoteFs.ensureDir(destParent);
    }

    // SFTP's RENAME fails when the destination exists, and the resulting error
    // is opaque. Check first so we can say what actually went wrong.
    let destExists = true;
    try {
      await remoteFs.lstat(dest);
    } catch (error) {
      // lstat throws when the path doesn't exist, which is the expected case here.
      destExists = false;
    }
    if (destExists) {
      throw new Error(`Can't rename to '${dest}' because it already exists.`);
    }

    await fileOperations.rename(src, dest, remoteFs);

    // The tree caches items by remote path, so every node at or below the old
    // path is now stale.
    purgeRemoteExplorerCache(this.fileService, this.config, src);

    refreshRemoteParent(this.fileService, this.config, src);
    if (destParent !== srcParent) {
      refreshRemoteParent(this.fileService, this.config, dest);
    }
  },
});
