import { COMMAND_REMOTE_BACKUPS_REFRESH } from '../constants';
import { remoteBackupsProvider } from '../modules/remoteBackups';
import { checkCommand } from './abstract/createCommand';

export default checkCommand({
  id: COMMAND_REMOTE_BACKUPS_REFRESH,

  handleCommand() {
    remoteBackupsProvider.refresh();
  },
});
