import * as vscode from 'vscode';
import logger from '../logger';

interface ConnectionState {
  host: string;
  protocol: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
}

const connections: Map<string, ConnectionState> = new Map();
let statusBarItem: vscode.StatusBarItem | undefined;

function getStatusBarItem(): vscode.StatusBarItem {
  if (!statusBarItem) {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    statusBarItem.show();
  }
  return statusBarItem;
}

function updateDisplay() {
  const item = getStatusBarItem();
  const values = Array.from(connections.values());
  const connected = values.filter(c => c.status === 'connected').length;
  const connecting = values.filter(c => c.status === 'connecting').length;
  const errors = values.filter(c => c.status === 'error').length;
  const total = values.length;

  if (total === 0) {
    item.text = '$(plug) SFTP';
    item.tooltip = 'SFTP: No active connections';
    item.color = undefined;
    return;
  }

  if (errors > 0) {
    item.text = `$(error) SFTP ${connected}/${total}`;
    item.tooltip = `SFTP: ${errors} connection(s) failed, ${connected} connected`;
    item.color = new vscode.ThemeColor('statusBarItem.errorBackground');
  } else if (connecting > 0) {
    item.text = `$(sync~spin) SFTP ${connected}/${total}`;
    item.tooltip = `SFTP: ${connecting} connecting, ${connected} connected`;
    item.color = new vscode.ThemeColor('statusBarItem.warningBackground');
  } else {
    item.text = `$(check) SFTP ${connected}/${total}`;
    item.tooltip = `SFTP: All ${connected} connection(s) healthy`;
    item.color = undefined;
  }
}

export function setConnectionState(
  identity: string,
  host: string,
  protocol: string,
  status: ConnectionState['status']
) {
  logger.debug(`Connection ${host} (${protocol}) → ${status}`);
  connections.set(identity, { host, protocol, status });
  updateDisplay();
}

export function removeConnection(identity: string) {
  connections.delete(identity);
  updateDisplay();
}

export function clearConnections() {
  connections.clear();
  updateDisplay();
}

export function getConnectionStates(): ConnectionState[] {
  return Array.from(connections.values());
}

export function dispose() {
  if (statusBarItem) {
    statusBarItem.dispose();
    statusBarItem = undefined;
  }
}
