import upath from './upath';
import { FileSystem, FileType, FileEntry } from './fs';
import { BackupConfig } from './fileService';
import * as fileOperations from './fileBaseOperations';
import logger from '../logger';

export interface BackupPathInfo {
  originalPath: string;
  timestamp: Date;
}

export function getBackupFolder(remotePath: string, backupFolder: string): string {
  return upath.join(remotePath, backupFolder);
}

export function getBackupDirForTarget(targetPath: string, backupFolder: string, remotePath: string): string {
  const backupRoot = getBackupFolder(remotePath, backupFolder);
  const relativeDir = upath.dirname(upath.relative(remotePath, targetPath));
  if (relativeDir === '.' || relativeDir === '/') {
    return backupRoot;
  }
  return upath.join(backupRoot, relativeDir);
}

export function getBackupPath(
  targetPath: string,
  backupFolder: string,
  remotePath: string,
  timestamp: Date = new Date()
): string {
  const backupDir = getBackupDirForTarget(targetPath, backupFolder, remotePath);
  const filename = upath.basename(targetPath);
  const timestampStr = formatTimestamp(timestamp);
  return upath.join(backupDir, `${filename}.${timestampStr}.bak`);
}

export function parseBackupPath(backupPath: string, backupFolder: string, remotePath: string): BackupPathInfo | null {
  const backupRoot = getBackupFolder(remotePath, backupFolder);
  if (!backupPath.startsWith(backupRoot)) {
    return null;
  }

  const relativeBackupPath = upath.relative(backupRoot, backupPath);
  const basename = upath.basename(relativeBackupPath);
  const dir = upath.dirname(relativeBackupPath);

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

  const originalPath = originalRelativeDir
    ? upath.join(remotePath, originalRelativeDir, originalFilename)
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
  remotePath: string
): Promise<string | null> {
  if (!backupConfig.enabled || backupConfig.versions <= 0) {
    return null;
  }

  logger.info(`creating backup for ${targetPath} on remote ${remotePath}`);

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

  let timestamp = new Date();
  let backupPath = getBackupPath(targetPath, backupConfig.folder, remotePath, timestamp);
  const backupDir = upath.dirname(backupPath);

  while (await fileExists(targetFs, backupPath)) {
    timestamp = new Date(timestamp.getTime() + 1);
    backupPath = getBackupPath(targetPath, backupConfig.folder, remotePath, timestamp);
  }

  logger.info(`backup target path: ${backupPath}`);

  try {
    await targetFs.ensureDir(backupDir);
    await copyRemoteFile(targetFs, targetPath, backupPath);
    logger.info(`backup created: ${targetPath} -> ${backupPath}`);
  } catch (error) {
    logger.warn(`failed to create backup for ${targetPath}: ${error.message}`);
    return null;
  }

  try {
    await pruneBackups(targetPath, targetFs, backupConfig, remotePath);
  } catch (error) {
    logger.warn(`failed to prune backups for ${targetPath}: ${error.message}`);
  }

  return backupPath;
}

async function copyRemoteFile(srcFs: FileSystem, srcPath: string, destPath: string): Promise<void> {
  const inputStream = await srcFs.get(srcPath);
  await srcFs.put(inputStream, destPath);
}

export async function pruneBackups(
  targetPath: string,
  targetFs: FileSystem,
  backupConfig: BackupConfig,
  remotePath: string
): Promise<void> {
  if (!backupConfig.enabled || backupConfig.versions <= 0) {
    logger.info(`prune skipped for ${targetPath}: enabled=${backupConfig.enabled}, versions=${backupConfig.versions}`);
    return;
  }

  const backupDir = getBackupDirForTarget(targetPath, backupConfig.folder, remotePath);
  const filename = upath.basename(targetPath);
  const backupPrefix = `${filename}.`;
  const backupSuffix = '.bak';

  logger.info(`pruning backups for ${targetPath} in ${backupDir} (keep ${backupConfig.versions})`);

  let entries: FileEntry[];
  try {
    entries = await targetFs.list(backupDir);
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
      await fileOperations.removeFile(item.entry.fspath, targetFs, undefined);
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
