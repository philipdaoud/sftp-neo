import * as vscode from 'vscode';

let _secrets: vscode.SecretStorage | undefined;

export function initSecrets(context: vscode.ExtensionContext) {
  _secrets = context.secrets;
}

function getKey(host: string, username: string, type: 'password' | 'passphrase'): string {
  return `sftp-neo:${host}:${username}:${type}`;
}

export async function getCredential(
  host: string,
  username: string,
  type: 'password' | 'passphrase'
): Promise<string | undefined> {
  if (!_secrets) {
    return undefined;
  }
  return _secrets.get(getKey(host, username, type));
}

export async function storeCredential(
  host: string,
  username: string,
  type: 'password' | 'passphrase',
  value: string
): Promise<void> {
  if (!_secrets) {
    return;
  }
  await _secrets.store(getKey(host, username, type), value);
}

export async function deleteCredential(
  host: string,
  username: string,
  type: 'password' | 'passphrase'
): Promise<void> {
  if (!_secrets) {
    return;
  }
  await _secrets.delete(getKey(host, username, type));
}
