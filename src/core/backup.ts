import upath from './upath';
import * as path from 'path';
import { FileSystem, FileType, FileEntry } from './fs';
import { BackupConfig } from './fileService';
import * as fileOperations from './fileBaseOperations';
import logger from '../logger';

export interface BackupPathInfo {
  originalPath: string;
  timestamp: Date;
}

export interface BackupStorage {
  fs: FileSystem;
  root: string;
  pathResolver: typeof path | typeof upath;
}

export function getBackupFolder(
  root: string,
  backupFolder: string,
  pathResolver: typeof path | typeof upath = upath
): string {
  return pathResolver.join(root, backupFolder);
}

export function getBackupDirForTarget(
  targetPath: string,
  backupFolder: string,
  remotePath: string,
  storageRoot?: string,
  pathResolver: typeof path | typeof upath = upath
): string {
  const backupRoot = storageRoot ?? getBackupFolder(remotePath, backupFolder, pathResolver);
  const relativeDir = upath.dirname(upath.relative(remotePath, targetPath));
  if (relativeDir === '.' || relativeDir === '/') {
    return backupRoot;
  }
  // Preserve remote directory layout, but use the backup filesystem's separators.
  const normalizedRelativeDir =
    pathResolver === upath ? relativeDir : pathResolver.normalize(relativeDir);
  return pathResolver.join(backupRoot, normalizedRelativeDir);
}

export function getBackupPath(
  targetPath: string,
  backupFolder: string,
  remotePath: string,
  timestamp: Date = new Date(),
  storageRoot?: string,
  pathResolver: typeof path | typeof upath = upath
): string {
  const backupDir = getBackupDirForTarget(targetPath, backupFolder, remotePath, storageRoot, pathResolver);
  const filename = upath.basename(targetPath);
  const timestampStr = formatTimestamp(timestamp);
  return pathResolver.join(backupDir, `${filename}.${timestampStr}.bak`);
}

export function parseBackupPath(
  backupPath: string,
  backupFolder: string,
  remotePath: string,
  storageRoot?: string,
  pathResolver: typeof path | typeof upath = upath
): BackupPathInfo | null {
  const backupRoot = storageRoot ?? getBackupFolder(remotePath, backupFolder, pathResolver);

  const normalizedBackupPath = pathResolver.normalize(backupPath);
  const normalizedBackupRoot = pathResolver.normalize(backupRoot);
  if (!normalizedBackupPath.startsWith(normalizedBackupRoot)) {
    return null;
  }

  const relativeBackupPath = pathResolver.relative(normalizedBackupRoot, normalizedBackupPath);
  const basename = pathResolver.basename(relativeBackupPath);
  const dir = pathResolver.dirname(relativeBackupPath);

  const match = basename.match(/^(.+)\.(\d{14,17})\.bak$/);
  if (!match) {
    return null;
  }

  const originalFilename = match[1];
  const parsedTimestamp = parseTimestamp(match[2]);
  if (!parsedTimestamp) {
    return null;
  }

  let originalRelativeDir = dir;
  if (originalRelativeDir === '.') {
    originalRelativeDir = '';
  }

  // Remote original paths are always posix; local separators need translation.
  const originalRelativeDirPosix =
    pathResolver === upath ? originalRelativeDir : originalRelativeDir.replace(/\\/g, '/');

  const originalPath = originalRelativeDirPosix
    ? upath.join(remotePath, originalRelativeDirPosix, originalFilename)
    : upath.join(remotePath, originalFilename);

  return {
    originalPath,
    timestamp: parsedTimestamp,
  };
}

export async function createBackup(
  targetPath: string,
  targetFs: FileSystem,
  backupConfig: BackupConfig,
  remotePath: string,
  storage?: BackupStorage
): Promise<string | null> {
  if (!backupConfig.enabled || backupConfig.versions <= 0) {
    return null;
  }

  const backupLocation = storage ? 'local' : 'remote';
  logger.info(`creating backup for ${targetPath} on ${backupLocation}`);

  try {
    const stat = await targetFs.lstat(targetPath);
    if (stat.type !== FileType.File) {
      logger.info(`skipping backup for ${targetPath}: not a file`);
      return null;
    }
  } catch (error) {
    logger.info(`skipping backup for ${targetPath}: ${error.message}`);
    return null;
  }

  const pathResolver = storage?.pathResolver ?? upath;
  const backupFs = storage?.fs ?? targetFs;
  const backupRoot = storage?.root ?? getBackupFolder(remotePath, backupConfig.folder, pathResolver);

  let timestamp = new Date();
  let backupPath = getBackupPath(targetPath, backupConfig.folder, remotePath, timestamp, backupRoot, pathResolver);
  const backupDir = pathResolver.dirname(backupPath);

  while (await fileExists(backupFs, backupPath)) {
    timestamp = new Date(timestamp.getTime() + 1);
    backupPath = getBackupPath(targetPath, backupConfig.folder, remotePath, timestamp, backupRoot, pathResolver);
  }

  logger.info(`backup target path: ${backupPath}`);

  try {
    await backupFs.ensureDir(backupDir);
    const inputStream = await targetFs.get(targetPath);
    await backupFs.put(inputStream, backupPath);
    logger.info(`backup created: ${targetPath} -> ${backupPath}`);
  } catch (error) {
    logger.warn(`failed to create backup for ${targetPath}: ${error.message}`);
    return null;
  }

  try {
    await pruneBackups(targetPath, targetFs, backupConfig, remotePath, storage);
  } catch (error) {
    logger.warn(`failed to prune backups for ${targetPath}: ${error.message}`);
  }

  return backupPath;
}

export async function pruneBackups(
  targetPath: string,
  targetFs: FileSystem,
  backupConfig: BackupConfig,
  remotePath: string,
  storage?: BackupStorage
): Promise<void> {
  if (!backupConfig.enabled || backupConfig.versions <= 0) {
    logger.info(`prune skipped for ${targetPath}: enabled=${backupConfig.enabled}, versions=${backupConfig.versions}`);
    return;
  }

  const pathResolver = storage?.pathResolver ?? upath;
  const backupFs = storage?.fs ?? targetFs;
  const backupRoot = storage?.root ?? getBackupFolder(remotePath, backupConfig.folder, pathResolver);

  const backupDir = getBackupDirForTarget(targetPath, backupConfig.folder, remotePath, backupRoot, pathResolver);
  const filename = upath.basename(targetPath);
  const backupPrefix = `${filename}.`;
  const backupSuffix = '.bak';

  logger.info(`pruning backups for ${targetPath} in ${backupDir} (keep ${backupConfig.versions})`);

  let entries: FileEntry[];
  try {
    entries = await backupFs.list(backupDir);
    logger.info(`found ${entries.length} entries in backup dir`);
  } catch (error) {
    logger.warn(`failed to list backup dir ${backupDir}: ${error.message}`);
    return;
  }

  const backups = entries
    .filter(entry => entry.type === FileType.File)
    .filter(entry => entry.name.startsWith(backupPrefix) && entry.name.endsWith(backupSuffix))
    .map(entry => {
      const timestampStr = entry.name.slice(backupPrefix.length, -backupSuffix.length);
      const parsed = parseTimestamp(timestampStr);
      logger.info(`backup candidate: ${entry.name} -> timestamp=${parsed ? parsed.toISOString() : 'null'}`);
      return {
        entry,
        timestamp: parsed,
      };
    })
    .filter((item): item is typeof item & { timestamp: Date } => item.timestamp !== null)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  logger.info(`matched ${backups.length} backups for ${targetPath}`);

  const toDelete = backups.slice(backupConfig.versions);
  logger.info(`will delete ${toDelete.length} old backups`);

  for (const item of toDelete) {
    try {
      await fileOperations.removeFile(item.entry.fspath, backupFs, undefined);
      logger.info(`pruned old backup: ${item.entry.fspath}`);
    } catch (error) {
      logger.warn(`failed to prune backup ${item.entry.fspath}: ${error.message}`);
    }
  }
}

async function fileExists(fs: FileSystem, path: string): Promise<boolean> {
  try {
    await fs.lstat(path);
    return true;
  } catch {
    return false;
  }
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const padMs = (n: number) => n.toString().padStart(3, '0');
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    padMs(date.getUTCMilliseconds())
  );
}

function parseTimestamp(str: string): Date | null {
  if (!/^\d{14,17}$/.test(str)) {
    return null;
  }
  const year = parseInt(str.slice(0, 4), 10);
  const month = parseInt(str.slice(4, 6), 10) - 1;
  const day = parseInt(str.slice(6, 8), 10);
  const hour = parseInt(str.slice(8, 10), 10);
  const minute = parseInt(str.slice(10, 12), 10);
  const second = parseInt(str.slice(12, 14), 10);
  const ms = str.length === 17 ? parseInt(str.slice(14, 17), 10) : 0;
  const date = new Date(Date.UTC(year, month, day, hour, minute, second, ms));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second ||
    date.getUTCMilliseconds() !== ms
  ) {
    return null;
  }
  return date;
}
