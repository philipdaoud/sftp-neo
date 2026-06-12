import { FileService } from '../../core';

export const CONTEXT_BACKUP_VERSION = 'backupVersion';

export interface BackupVersion {
  fileService: FileService;
  backupPath: string;
  originalPath: string;
  timestamp: Date;
  size?: number;
}

export type BackupItem = BackupVersion;
