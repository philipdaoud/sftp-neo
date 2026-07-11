import * as vscode from 'vscode';
import debounce from 'lodash.debounce';
import app from '../app';
import { COMMAND_REMOTEEXPLORER_FILTER } from '../constants';
import { checkCommand } from './abstract/createCommand';

export default checkCommand({
  id: COMMAND_REMOTEEXPLORER_FILTER,

  handleCommand() {
    const currentFilter = app.remoteExplorer.getFilter();
    const quickPick = vscode.window.createQuickPick();

    quickPick.placeholder = 'Type to filter files and folders in the Remote Explorer';
    quickPick.value = currentFilter;
    quickPick.ignoreFocusOut = true;
    quickPick.items = [];

    const applyFilter = debounce((query: string) => {
      app.remoteExplorer.setFilter(query);
    }, 150);

    const disposables: vscode.Disposable[] = [];

    disposables.push(
      quickPick.onDidChangeValue(value => {
        applyFilter(value);
      })
    );

    disposables.push(
      quickPick.onDidAccept(() => {
        app.remoteExplorer.setFilter(quickPick.value);
        quickPick.hide();
      })
    );

    disposables.push(
      quickPick.onDidHide(() => {
        applyFilter.flush();
        disposables.forEach(d => d.dispose());
        quickPick.dispose();
      })
    );

    quickPick.show();
  },
});
