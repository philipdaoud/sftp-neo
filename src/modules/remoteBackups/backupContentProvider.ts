import * as vscode from 'vscode';
import localFs from '../../core/localFs';
import { getAllFileService } from '../serviceManager';

export const BACKUP_SCHEME = 'sftp-backup';

export function createBackupUri(fileServiceId: number, backupPath: string, location: 'local' | 'remote' = 'remote'): vscode.Uri {
  return vscode.Uri.parse(`${BACKUP_SCHEME}:${encodeURIComponent(backupPath)}?serviceId=${fileServiceId}&location=${location}`);
}

export class BackupContentProvider implements vscode.TextDocumentContentProvider {
  private _onDidChange: vscode.EventEmitter<vscode.Uri> = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const params = new URLSearchParams(uri.query);
    const fileServiceId = parseInt(params.get('serviceId') || '', 10);
    const backupPath = decodeURIComponent(uri.path);
    const location = (params.get('location') as 'local' | 'remote') || 'remote';

    const fileService = getAllFileService().find(service => service.id === fileServiceId);
    if (!fileService) {
      throw new Error(`Cannot find file service for backup ${backupPath}`);
    }

    const config = fileService.getConfig();
    const backupFs = location === 'local' ? localFs : await fileService.getRemoteFileSystem(config);
    const content = await backupFs.readFile(backupPath);
    return content.toString();
  }

  refresh(uri: vscode.Uri) {
    this._onDidChange.fire(uri);
  }
}

export const backupContentProvider = new BackupContentProvider();
