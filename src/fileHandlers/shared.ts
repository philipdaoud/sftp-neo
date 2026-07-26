import { UResource, FileService, FileType, ServiceConfig } from '../core';
import app from '../app';

function makeRemoteResource(fileService: FileService, config: ServiceConfig, remoteFsPath: string) {
  return UResource.makeResource({
    remote: {
      host: config.host,
      port: config.port,
    },
    remoteId: fileService.id,
    fsPath: remoteFsPath,
  });
}

/**
 * Refresh the tree node holding `remoteFsPath`.
 *
 * Passing `isDirectory: false` makes the tree walk up to the parent before
 * firing, which is what we want after the node itself has been removed or
 * renamed away.
 */
export function refreshRemoteParent(
  fileService: FileService,
  config: ServiceConfig,
  remoteFsPath: string
) {
  app.remoteExplorer.refresh({
    resource: makeRemoteResource(fileService, config, remoteFsPath),
    isDirectory: false,
  });
}

/**
 * Drop `remoteFsPath` and everything under it from the tree's item cache.
 */
export function purgeRemoteExplorerCache(
  fileService: FileService,
  config: ServiceConfig,
  remoteFsPath: string
) {
  app.remoteExplorer.purge(makeRemoteResource(fileService, config, remoteFsPath).uri);
}

// NEED_VSCODE_UPDATE: detect explorer view visible
// refresh will open explorer view which cause a problem (opening explorer on refresh)
// export function refreshLocalExplorer(localUri: Uri) {
//   // do nothing
// }

export async function refreshRemoteExplorer(target: UResource, isDirectory: FileService | boolean) {
  if (isDirectory instanceof FileService) {
    const fileService = isDirectory;
    const localFs = fileService.getLocalFileSystem();
    const fileEntry = await localFs.lstat(target.localFsPath);
    isDirectory = fileEntry.type === FileType.Directory;
  }

  app.remoteExplorer.refresh({
    resource: UResource.makeResource(target.remoteUri),
    isDirectory,
  });
}
