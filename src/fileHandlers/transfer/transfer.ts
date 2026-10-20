import {
  FileSystem,
  FileEntry,
  FileType,
  TransferTask,
  TransferOption as TransferTaskTransferOption,
  TransferDirection,
  fileOperations,
} from '../../core';
import { FileHandleOption } from '../option';
import { flatten } from '../../utils';
import logger from '../../logger';
import { getOpenTextDocuments } from '../../host';

interface InternalTransferOption extends FileHandleOption, TransferTaskTransferOption {
  // plan only: collect tasks and deletions without touching either filesystem
  dryRun?: boolean;
  // plan only: told about every folder the sync would create
  planFolder?: (fsPath: string, direction: TransferDirection) => void;
}

type ExternalTransferOption<T extends InternalTransferOption> = Pick<
  T,
  Exclude<keyof T, 'mtime' | 'atime' | 'mode' | 'fallbackMode'>
>;

type TransferOption = ExternalTransferOption<InternalTransferOption>;
interface SyncOption extends TransferOption {
  // delete extraneous files from dest dirs
  delete?: boolean;

  // skip creating new files on dest
  skipCreate?: boolean;

  // skip updating files that exist on dest
  ignoreExisting?: boolean;

  // update the dest only if a newer version is on the src filesystem
  update?: boolean;

  // make newest file to be present in both locations.
  bothDiretions?: boolean;

  // when to show the Preview Sync list before running
  preview?: 'always' | 'onDelete' | 'never';
}

interface BaseTransferHandleConfig {
  srcFsPath: string;
  targetFsPath: string;
  dirPerm?: number,
  filePerm?: number,
  srcFs: FileSystem;
  targetFs: FileSystem;
  transferDirection: TransferDirection;
}

interface TransferHandleConfig<T> extends BaseTransferHandleConfig {
  transferOption: T;
}

function getAltDirection(direction: TransferDirection) {
  return direction === TransferDirection.LOCAL_TO_REMOTE
    ? TransferDirection.REMOTE_TO_LOCAL
    : TransferDirection.LOCAL_TO_REMOTE;
}

function isFileModified(a: FileEntry, b: FileEntry): boolean {
  // compare time at seconds
  return Math.floor(a.mtime / 1000) !== Math.floor(b.mtime / 1000) || a.size !== b.size;
}

function toHash<T, R = T>(items: T[], key: string, transform?: (a: T) => R): { [key: string]: R } {
  return items.reduce((hash, item) => {
    const transformedItem = transform ? transform(item) : item;
    hash[transformedItem[key]] = transformedItem;
    return hash;
  }, {});
}

// Save an open, unsaved editor for `fsPath` so its edits are what gets uploaded.
// Resolves the new mtime, or `undefined` when nothing was saved.
async function saveBeforeUpload(fsPath: string, fs: FileSystem): Promise<number | undefined> {
  const document = getOpenTextDocuments().find(doc => doc.fileName === fsPath);
  if (!document || document.isClosed || !document.isDirty) {
    return undefined;
  }
  await document.save();
  logger.info('save before upload.');
  const stat = await fs.lstat(fsPath);
  return stat.mtime;
}

async function transferFolder(
  config: TransferHandleConfig<TransferOption>,
  collect: (t: TransferTask) => void
) {
  const { srcFsPath, targetFsPath, srcFs, targetFs, transferOption } = config;

  if (transferOption.ignore && transferOption.ignore(srcFsPath)) {
    return;
  }

  // Need this to make sure file can correct transfer
  if (transferOption.dryRun) {
    transferOption.planFolder?.(targetFsPath, config.transferDirection);
  } else {
    await targetFs.ensureDir(targetFsPath);
  }

  // If dirPerm is configured, we chmod the remote directory after creation.
  if(config.transferOption.dirPerm && !transferOption.dryRun) {
    logger.info("chmod remote directory as configured by dirPerm, dirPerm is: ", config.transferOption.dirPerm)
    await targetFs.chmod(targetFsPath, parseInt(String(config.transferOption.dirPerm), 8))
  }

  const fileEntries = await srcFs.list(srcFsPath);
  await Promise.all(
    fileEntries.map(file =>
      transferWithType(
        {
          ...config,
          transferOption: {
            ...config.transferOption,
            mtime: file.mtime,
            atime: file.atime,
          },
          srcFsPath: file.fspath,
          targetFsPath: targetFs.pathResolver.join(targetFsPath, file.name),
          ensureDirExist: false,
        },
        file.type,
        collect
      )
    )
  );

  logger.info('folder transfered.');
}

async function transferFile(
  config: TransferHandleConfig<InternalTransferOption>,
  fileType: FileType,
  collect: (t: TransferTask) => void
) {
  if (config.transferOption.ignore && config.transferOption.ignore(config.srcFsPath)) {
    return;
  }

  collect(
    new TransferTask(
      {
        fsPath: config.srcFsPath,
        fileSystem: config.srcFs,
      },
      {
        fsPath: config.targetFsPath,
        fileSystem: config.targetFs,
      },
      {
        fileType,
        transferDirection: config.transferDirection,
        transferOption: config.transferOption,
      }
    )
  );
}

async function transferWithType(
  config: TransferHandleConfig<InternalTransferOption> & {
    ensureDirExist: boolean;
  },
  fileType: FileType,
  collect: (t: TransferTask) => void
) {
  switch (fileType) {
    case FileType.Directory:
      await transferFolder(config, collect);
      break;
    case FileType.File:
    case FileType.SymbolicLink:
      if (config.ensureDirExist) {
        const { targetFs, targetFsPath } = config;
        await targetFs.ensureDir(targetFs.pathResolver.dirname(targetFsPath));
        // If dirPerm is configured, we chmod the remote directory after creation.
        if(config.transferOption.dirPerm) {
          logger.info("Running chmod on remote directory with perm: ", config.transferOption.dirPerm)
          await targetFs.chmod(targetFs.pathResolver.dirname(targetFsPath), parseInt(String(config.transferOption.dirPerm), 8));
        }
      }
      // <<< save before upload: start
      if (
        config.transferDirection === TransferDirection.LOCAL_TO_REMOTE &&
        !config.transferOption.dryRun
      ) {
        const mtime = await saveBeforeUpload(config.srcFsPath, config.srcFs);
        if (mtime !== undefined) {
          config.transferOption.mtime = mtime;
        }
      }
      // save before upload: end >>>
      await transferFile(config, fileType, collect);
      break;
    default:
      logger.warn(`Unsupported file type (type = ${fileType}). File ${config.srcFsPath}`);
  }
}

async function removeFile(
  file: string,
  fs: FileSystem,
  fileType: FileType,
  option,
  direction: TransferDirection
) {
  if (option.ignore && option.ignore(file)) {
    return;
  }

  // Deletions target the receiving side, which is local when syncing
  // remote ➞ local. Label it so the log is not misleading.
  const side =
    direction === TransferDirection.LOCAL_TO_REMOTE ? 'remote' : 'local';

  switch (fileType) {
    case FileType.Directory:
      await fileOperations.removeDir(file, fs, option);
      logger.info(`${side} folder removed: ${file}`);
      break;
    case FileType.File:
    case FileType.SymbolicLink:
      await fileOperations.removeFile(file, fs, option);
      logger.info(`${side} file removed: ${file}`);
      break;
    default:
      break;
  }
}

async function _sync(
  config: TransferHandleConfig<SyncOption>,
  collect: (t: TransferTask) => void,
  deleted: FileEntry[]
) {

  const { srcFsPath, targetFsPath, srcFs, targetFs, transferOption, transferDirection } = config;
  if (transferOption.ignore && transferOption.ignore(srcFsPath)) {
    return;
  }

  const altDirection = getAltDirection(transferDirection);
  const syncFiles = async (srcFileEntries: FileEntry[], desFileEntries: FileEntry[]) => {
    const srcFileTable = toHash(srcFileEntries, 'id', fileEntry => ({
      ...fileEntry,
      id: fileEntry.name,
    }));

    const desFileTable = toHash(desFileEntries, 'id', fileEntry => ({
      ...fileEntry,
      id: fileEntry.name,
    }));

    const file2trans: [string, string, TransferDirection, InternalTransferOption][] = [];
    const dir2trans: [string, string, TransferDirection][] = [];
    const dir2sync: [string, string][] = [];

    const fileMissed: string[] = [];
    const dirMissed: string[] = [];

    Object.keys(srcFileTable).forEach(id => {
      const srcFile = srcFileTable[id];
      const desFile = desFileTable[id];
      delete desFileTable[id];

      // files exist on both side
      if (desFile) {
        if (transferOption.ignoreExisting) {
          return;
        }

        let from: FileEntry = srcFile;
        let to: FileEntry = desFile;
        let direction: TransferDirection = transferDirection;
        switch (from.type) {
          case FileType.Directory:
            dir2sync.push([from.fspath, to.fspath]);
            break;
          case FileType.File:
          case FileType.SymbolicLink:
            if (transferOption.bothDiretions) {
              // from new to old
              if (desFile.mtime > srcFile.mtime) {
                from = desFile;
                to = srcFile;
                direction = altDirection;
              }
            }

            if (transferOption.update) {
              if (from.mtime <= to.mtime) {
                return;
              }
            }

            // only transfer changed files
            if (isFileModified(from, to)) {
              file2trans.push([
                from.fspath,
                to.fspath,
                direction,
                {
                  ...transferOption,
                  mode: to.mode, // prefer target mode
                  mtime: from.mtime,
                  atime: from.atime,
                  syncAction: 'update',
                },
              ]);
            }
            break;
          default:
          // do not process
        }
        return;
      }

      // files exist only on src
      if (transferOption.skipCreate) {
        return;
      }

      const fspath = targetFs.pathResolver.join(targetFsPath, srcFile.name);
      switch (srcFile.type) {
        case FileType.Directory:
          dir2trans.push([srcFile.fspath, fspath, transferDirection]);
          break;
        case FileType.File:
        case FileType.SymbolicLink:
          file2trans.push([
            srcFile.fspath,
            fspath,
            transferDirection,
            {
              ...transferOption,
              fallbackMode: srcFile.mode,
              mtime: srcFile.mtime,
              atime: srcFile.atime,
              syncAction: 'create',
            },
          ]);
          break;
        default:
        // do not process
      }
    });

    // files exist only on target
    if (transferOption.bothDiretions) {
      if (transferOption.skipCreate !== true) {
        Object.keys(desFileTable).forEach(id => {
          const file = desFileTable[id];
          const fspath = srcFs.pathResolver.join(srcFsPath, file.name);
          switch (file.type) {
            case FileType.Directory:
              dir2trans.push([file.fspath, fspath, altDirection]);
              break;
            case FileType.File:
            case FileType.SymbolicLink:
              file2trans.push([
                file.fspath,
                fspath,
                altDirection,
                {
                  ...transferOption,
                  fallbackMode: file.mode,
                  mtime: file.mtime,
                  atime: file.atime,
                  syncAction: 'create',
                },
              ]);
              break;
            default:
            // do not process
          }
        });
      }
    } else if (transferOption.delete) {
      Object.keys(desFileTable).forEach(id => {
        const file = desFileTable[id];
        deleted.push(file);
        switch (file.type) {
          case FileType.Directory:
            dirMissed.push(file.fspath);
            break;
          case FileType.File:
          case FileType.SymbolicLink:
            fileMissed.push(file.fspath);
            break;
          default:
          // do not process
        }
      });
    }

    // side-effect
    if (!transferOption.dryRun) {
      await Promise.all(
        fileMissed.map(file =>
          removeFile(file, targetFs, FileType.File, transferOption, transferDirection)
        )
      );
      await Promise.all(
        dirMissed.map(file =>
          removeFile(file, targetFs, FileType.Directory, transferOption, transferDirection)
        )
      );
    }

    const transFilePromise = file2trans.map(([src, target, direction, option]) => {
      const isReversed = direction === altDirection;
      return transferFile(
        {
          ...config,
          srcFs: isReversed ? config.targetFs : config.srcFs,
          targetFs: isReversed ? config.srcFs : config.targetFs,
          transferDirection: direction,
          transferOption: option,
          srcFsPath: src,
          targetFsPath: target,
        },
        FileType.File,
        collect
      );
    });

    const transDirPromise = dir2trans.map(([src, target, direction]) => {
      const isReversed = direction === altDirection;
      return transferFolder(
        {
          ...config,
          srcFs: isReversed ? config.targetFs : config.srcFs,
          targetFs: isReversed ? config.srcFs : config.targetFs,
          transferDirection: direction,
          transferOption: { ...transferOption, syncAction: 'create' },
          srcFsPath: src,
          targetFsPath: target,
        },
        collect
      );
    });

    const syncPromise = dir2sync.map(([src, target]) =>
      _sync(
        {
          ...config,
          srcFsPath: src,
          targetFsPath: target,
        },
        collect,
        deleted
      )
    );

    return Promise.all([...transFilePromise, ...transDirPromise, ...syncPromise]).then(flatten);
  };

  // create dir here so we don't have to ensure it for children files.
  if (!transferOption.dryRun) {
    await targetFs.ensureDir(targetFsPath);
  }

  const files = await Promise.all([
    srcFs.list(srcFsPath).catch(() => []),
    targetFs.list(targetFsPath).catch(() => []),
  ]);
  await syncFiles(...files);
}

export { TransferOption, SyncOption, TransferDirection };

export async function transfer(
  config: TransferHandleConfig<TransferOption>,
  collect: (t: TransferTask) => void
) {
  const stat = await config.srcFs.lstat(config.srcFsPath);
  const transferOption = {
    ...config.transferOption,
    fallbackMode: stat.mode,
    mtime: stat.mtime,
    atime: stat.atime,
    filePerm: config?.filePerm,
    dirPerm: config?.dirPerm
  };
  await transferWithType({ ...config, transferOption, ensureDirExist: true }, stat.type, collect);
}

export async function sync(
  config: TransferHandleConfig<SyncOption>,
  collect: (t: TransferTask) => void
): Promise<FileEntry[]> {
  const deleted: FileEntry[] = [];
  await _sync(config, collect, deleted);
  return deleted;
}

export interface SyncPlan {
  transfers: TransferTask[];
  // entries that exist only on the target and would be removed (`delete` option)
  deletions: FileEntry[];
  // new folders with nothing planned inside them; other new folders are
  // created as parents of their transfers
  folders: SyncPlanFolder[];
  // the side deletions are applied to
  deletionDirection: TransferDirection;
}

export interface SyncPlanFolder {
  fsPath: string;
  direction: TransferDirection;
}

export type SyncPlanItem =
  | { kind: 'transfer'; task: TransferTask }
  | { kind: 'delete'; entry: FileEntry }
  | { kind: 'folder'; folder: SyncPlanFolder };

export function syncPlanKey(item: SyncPlanItem): string {
  switch (item.kind) {
    case 'transfer':
      return `${item.task.transferType}:${item.task.targetFsPath}`;
    case 'delete':
      return `delete:${item.entry.fspath}`;
    case 'folder':
      return `folder:${item.folder.direction}:${item.folder.fsPath}`;
  }
}

export async function planSync(config: TransferHandleConfig<SyncOption>): Promise<SyncPlan> {
  const transfers: TransferTask[] = [];
  const deletions: FileEntry[] = [];
  const newFolders: SyncPlanFolder[] = [];
  const planFolder = (fsPath: string, direction: TransferDirection) =>
    newFolders.push({ fsPath, direction });
  await _sync(
    { ...config, transferOption: { ...config.transferOption, dryRun: true, planFolder } },
    t => transfers.push(t),
    deletions
  );

  const pathResolver = config.targetFs.pathResolver;
  const occupied = new Set<string>();
  const markParents = (direction: TransferDirection, fsPath: string) => {
    let dir = pathResolver.dirname(fsPath);
    while (!occupied.has(`${direction}:${dir}`)) {
      occupied.add(`${direction}:${dir}`);
      const parent = pathResolver.dirname(dir);
      if (parent === dir) {
        break;
      }
      dir = parent;
    }
  };
  transfers.forEach(t => markParents(t.transferType, t.targetFsPath));
  newFolders.forEach(f => markParents(f.direction, f.fsPath));
  const folders = newFolders.filter(f => !occupied.has(`${f.direction}:${f.fsPath}`));

  return { transfers, deletions, folders, deletionDirection: config.transferDirection };
}

/**
 * Apply the selected part of a plan built by `planSync`. Deletions run first,
 * as in a direct sync. Parent folders are created here because the dry run
 * skipped every `ensureDir`.
 */
export async function executeSyncPlan(
  plan: SyncPlan,
  keep: (key: string) => boolean,
  config: TransferHandleConfig<SyncOption>,
  collect: (t: TransferTask) => void
) {
  const { targetFs, transferOption } = config;
  const option = { ...transferOption, dryRun: false };

  const deletions = plan.deletions.filter(entry => keep(syncPlanKey({ kind: 'delete', entry })));
  const isDir = (e: FileEntry) => e.type === FileType.Directory;
  await Promise.all(
    deletions
      .filter(e => !isDir(e))
      .map(e => removeFile(e.fspath, targetFs, e.type, option, plan.deletionDirection))
  );
  await Promise.all(
    deletions
      .filter(isDir)
      .map(e => removeFile(e.fspath, targetFs, e.type, option, plan.deletionDirection))
  );

  const ensured = new Set<string>();
  // Walk up to the sync root so every folder the dry run skipped is created,
  // and only newly created folders get `dirPerm` (matching a direct sync).
  const ensureFolder = async (direction: TransferDirection, folder: string) => {
    const fs = direction === config.transferDirection ? config.targetFs : config.srcFs;
    const root = direction === config.transferDirection ? config.targetFsPath : config.srcFsPath;
    const chmodPerm =
      transferOption.dirPerm && direction === TransferDirection.LOCAL_TO_REMOTE
        ? parseInt(String(transferOption.dirPerm), 8)
        : undefined;

    const missing: string[] = [];
    let dir = folder;
    while (!ensured.has(`${direction}:${dir}`)) {
      ensured.add(`${direction}:${dir}`);
      missing.unshift(dir);
      const parent = fs.pathResolver.dirname(dir);
      if (dir === root || parent === dir || !dir.startsWith(root)) {
        break;
      }
      dir = parent;
    }
    for (const d of missing) {
      const exists = await fs.lstat(d).then(() => true, () => false);
      if (exists) {
        continue;
      }
      await fs.ensureDir(d);
      if (chmodPerm !== undefined) {
        await fs.chmod(d, chmodPerm);
      }
    }
  };

  const transfers = plan.transfers.filter(task => keep(syncPlanKey({ kind: 'transfer', task })));
  for (const task of transfers) {
    await ensureFolder(task.transferType, task.targetFileSystem.pathResolver.dirname(task.targetFsPath));
  }
  for (const folder of plan.folders) {
    if (keep(syncPlanKey({ kind: 'folder', folder }))) {
      await ensureFolder(folder.direction, folder.fsPath);
    }
  }
  // The dry run skipped saving, so save only what is about to be uploaded.
  for (const task of transfers) {
    if (task.transferType === TransferDirection.LOCAL_TO_REMOTE) {
      const mtime = await saveBeforeUpload(task.srcFsPath, task.srcFileSystem);
      if (mtime !== undefined) {
        task.updateMtime(mtime);
      }
    }
  }
  transfers.forEach(collect);
}
