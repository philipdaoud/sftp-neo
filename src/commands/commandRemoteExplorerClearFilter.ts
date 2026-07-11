import app from '../app';
import { COMMAND_REMOTEEXPLORER_CLEAR_FILTER } from '../constants';
import { checkCommand } from './abstract/createCommand';

export default checkCommand({
  id: COMMAND_REMOTEEXPLORER_CLEAR_FILTER,

  handleCommand() {
    app.remoteExplorer.setFilter('');
  },
});
