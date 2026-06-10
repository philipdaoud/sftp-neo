import { ExtensionContext } from 'vscode';
import logger from './logger';
import { registerCommand, showErrorMessage } from './host';
import Command from './commands/abstract/command';
import { createCommand, createFileCommand, createFileMultiCommand } from './commands/abstract/createCommand';

export default function init(context: ExtensionContext) {
  // Collect per-command load failures so a broken build (e.g. a missing
  // dependency that throws while a command module is required) doesn't fail
  // silently, leaving commands unregistered with no user-visible signal.
  const failures: string[] = [];

  loadCommands(
    (require as any).context(
      // Look for files in the commands directory
      './commands',
      // Do not look in subdirectories
      false,
      // Only include "_base-" prefixed .vue files
      /command.*.ts$/
    ),
    /command(.*)/,
    createCommand,
    context,
    failures
  );
  loadCommands(
    (require as any).context(
      // Look for files in the current directory
      './commands',
      // Do not look in subdirectories
      false,
      // Only include "_base-" prefixed .vue files
      /fileCommand.*.ts$/
    ),
    /fileCommand(.*)/,
    createFileCommand,
    context,
    failures
  );
  loadCommands(
    (require as any).context(
      // Look for files in the current directory
      './commands',
      // Do not look in subdirectories
      false,
      // Only include "_base-" prefixed .vue files
      /fileMultiCommand.*.ts$/
    ),
    /fileMultiCommand(.*)/,
    createFileMultiCommand,
    context,
    failures
  );

  if (failures.length > 0) {
    showErrorMessage(
      `SFTP: ${failures.length} command(s) failed to load and are unavailable. ` +
        `See the "sftp" output channel for details.`
    );
  }
}

function nomalizeCommandName(rawName) {
  const firstLetter = rawName[0].toUpperCase();
  return firstLetter + rawName.slice(1).replace(/[A-Z]/g, token => ` ${token[0]}`);
}

function loadCommands(
  requireContext,
  nameRegex,
  commandCreator,
  context: ExtensionContext,
  failures: string[]
) {
  requireContext.keys().forEach(fileName => {
    const clearName = fileName
      // Remove the "./" from the beginning
      .replace(/^\.\//, '')
      // Remove the file extension from the end
      .replace(/\.\w+$/, '');

    const match = nameRegex.exec(clearName);
    if (!match || !match[1]) {
      logger.warn(`Command name not found from ${fileName}`);
      return;
    }

    try {
      const commandOption = requireContext(fileName).default;
      commandOption.name = nomalizeCommandName(match[1]);
      // tslint:disable-next-line variable-name
      const Cmd = commandCreator(commandOption);
      const cmdInstance: Command = new Cmd();
      logger.debug(`register command "${commandOption.name}" from "${fileName}"`);
      registerCommand(context, commandOption.id, cmdInstance.run, cmdInstance);
    } catch (error) {
      failures.push(fileName);
      logger.error(error, `load command "${fileName}"`);
    }
  });
}
