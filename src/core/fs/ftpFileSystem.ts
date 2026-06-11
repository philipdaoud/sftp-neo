import { Readable, PassThrough } from 'stream';
import { Client, FileInfo as BasicFileInfo, FileType as BasicFileType } from 'basic-ftp';
import logger from '../../logger';
import { FileEntry, FileType, FileStats, FileOption } from './fileSystem';
import RemoteFileSystem from './remoteFileSystem';
import { FTPClient } from '../remote-client';

interface FtpFileHandle {
  path: string;
  flags: string;
  mode?: number;
}

function basicTypeToFileType(type: BasicFileType): FileType {
  switch (type) {
    case BasicFileType.File:
      return FileType.File;
    case BasicFileType.Directory:
      return FileType.Directory;
    case BasicFileType.SymbolicLink:
      return FileType.SymbolicLink;
    default:
      return FileType.Unknown;
  }
}

function permissionsToMode(permissions?: { user: number; group: number; world: number }): number {
  if (!permissions) {
    return 0o666;
  }
  return (permissions.user << 6) | (permissions.group << 3) | permissions.world;
}

export default class FTPFileSystem extends RemoteFileSystem {
  private _supportMFMT: boolean = true;

  get ftp(): Client {
    return this.getClient().getFsClient();
  }

  toFileStat(info: BasicFileInfo): FileStats {
    const mtime = info.modifiedAt
      ? this.toLocalTime(info.modifiedAt.getTime())
      : 0;
    return {
      type: basicTypeToFileType(info.type),
      mode: permissionsToMode(info.permissions),
      size: info.size,
      mtime,
      atime: mtime,
      target: info.link,
    };
  }

  toFileEntry(fullPath: string, info: BasicFileInfo): FileEntry {
    return {
      fspath: fullPath,
      name: info.name,
      ...this.toFileStat(info),
    };
  }

  _createClient(option) {
    return new FTPClient(option);
  }

  async lstat(path: string): Promise<FileStats> {
    if (path === '/') {
      return {
        type: FileType.Directory,
        mode: 0o666,
        size: 0,
        mtime: 0,
        atime: 0,
      };
    }

    const parentPath = this.pathResolver.dirname(path);
    const nameIdentity = this.pathResolver.basename(path);
    const stats = await this.list(parentPath);

    const fileStat = stats.find(ns => ns.name === nameIdentity);

    if (!fileStat) {
      throw new Error('file not exist');
    }

    return fileStat;
  }

  open(path: string, flags: string, mode?: number): Promise<FtpFileHandle> {
    return Promise.resolve({
      path,
      flags,
      mode,
    });
  }

  close(_fd: FtpFileHandle): Promise<void> {
    return Promise.resolve();
  }

  fstat(fd: FtpFileHandle): Promise<FileStats> {
    return this.lstat(fd.path);
  }

  async futimes(fd: FtpFileHandle, _atime: number, mtime: number): Promise<void> {
    if (!this._supportMFMT) {
      return;
    }

    try {
      await this._sendMFMT(fd.path, new Date(mtime * 1000));
    } catch {
      logger.info('Don\'t Support MFMT');
      this._supportMFMT = false;
    }
  }

  async get(path: string, _option?: FileOption): Promise<Readable> {
    const stream = new PassThrough();

    // Start download asynchronously; errors will destroy the stream
    this.ftp.downloadTo(stream, path).catch(err => {
      if (!stream.destroyed) {
        stream.destroy(err);
      }
    });

    return stream;
  }

  async chmod(path: string, mode: number): Promise<void> {
    await this.ftp.send(`SITE CHMOD ${mode.toString(8)} ${path}`);
  }

  async fchmod(fd: FtpFileHandle, mode: number): Promise<void> {
    await this.ftp.send(`SITE CHMOD ${mode.toString(8)} ${fd.path}`);
  }

  async put(input: Readable, path: string, _option?: FileOption): Promise<void> {
    let inputError: Error | undefined;
    input.once('error', err => {
      inputError = err;
      try {
        this.ftp.close();
      } catch {
        // ignore
      }
    });

    try {
      await this.ftp.uploadFrom(input, path);
    } catch (error) {
      throw inputError || error;
    }
  }

  readlink(path: string): Promise<string> {
    return this.lstat(path).then(stat => stat.target || path);
  }

  symlink(_targetPath: string, _path: string): Promise<void> {
    // Not supported by basic-ftp
    return Promise.resolve();
  }

  async mkdir(dir: string): Promise<void> {
    await this.ftp.ensureDir(dir);
  }

  async ensureDir(dir: string): Promise<void> {
    await this.ftp.ensureDir(dir);
  }

  async list(dir: string): Promise<FileEntry[]> {
    const infos = await this.ftp.list(dir);

    return infos
      .filter(info => info.name !== '.' && info.name !== '..')
      .map(info => this.toFileEntry(this.pathResolver.join(dir, info.name), info));
  }

  async unlink(path: string): Promise<void> {
    await this.ftp.remove(path);
  }

  async rmdir(path: string, recursive: boolean): Promise<void> {
    if (recursive) {
      await this.ftp.removeDir(path);
    } else {
      await this.ftp.send(`RMD ${path}`);
    }
  }

  async rename(srcPath: string, destPath: string): Promise<void> {
    await this.ftp.rename(srcPath, destPath);
  }

  async renameAtomic(srcPath: string, destPath: string): Promise<void> {
    // basic-ftp does not support atomic rename; fall back to regular rename
    await this.ftp.rename(srcPath, destPath);
  }

  private async _sendMFMT(path: string, date: Date): Promise<void> {
    const dateStr =
      date.getUTCFullYear() +
      ('00' + (date.getUTCMonth() + 1)).slice(-2) +
      ('00' + date.getUTCDate()).slice(-2) +
      ('00' + date.getUTCHours()).slice(-2) +
      ('00' + date.getUTCMinutes()).slice(-2) +
      ('00' + date.getUTCSeconds()).slice(-2);

    await this.ftp.send(`MFMT ${dateStr} ${path}`);
  }
}
