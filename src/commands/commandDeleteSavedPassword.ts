import * as vscode from 'vscode';
import { COMMAND_DELETE_SAVED_PASSWORD } from '../constants';
import { showInformationMessage } from '../host';
import { getAllFileService } from '../modules/serviceManager';
import { getCredential, deleteCredential } from '../modules/secrets';
import { checkCommand } from './abstract/createCommand';

interface CredentialItem extends vscode.QuickPickItem {
  host: string;
  username: string;
  type: 'password' | 'passphrase';
}

export default checkCommand({
  id: COMMAND_DELETE_SAVED_PASSWORD,

  async handleCommand() {
    const items: CredentialItem[] = [];

    for (const service of getAllFileService()) {
      const configs = [service.getConfig()];
      if (service.getAvailableProfiles().length > 0) {
        configs.push(...service.getAllConfig());
      }

      for (const config of configs) {
        const host = config.host;
        const username = config.username;
        if (!host || !username) {
          continue;
        }

        const password = await getCredential(host, username, 'password');
        if (password !== undefined) {
          items.push({
            host,
            username,
            type: 'password',
            label: `$(key) Password for ${username}@${host}`,
            description: config.name || '',
          });
        }

        const passphrase = await getCredential(host, username, 'passphrase');
        if (passphrase !== undefined) {
          items.push({
            host,
            username,
            type: 'passphrase',
            label: `$(lock) Passphrase for ${username}@${host}`,
            description: config.name || '',
          });
        }
      }
    }

    if (items.length === 0) {
      showInformationMessage('No saved credentials found in Secret Storage.');
      return;
    }

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select saved credential(s) to delete',
      canPickMany: true,
    });

    if (!selected || selected.length === 0) {
      return;
    }

    for (const item of selected) {
      await deleteCredential(item.host, item.username, item.type);
    }

    showInformationMessage(
      `Deleted ${selected.length} saved credential(s) from Secret Storage.`
    );
  },
});
