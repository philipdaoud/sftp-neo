import { exec } from 'child_process';
import logger from '../logger';
import { showErrorMessage } from '../host';

export type HookType = 'preUpload' | 'postUpload' | 'preDownload' | 'postDownload' | 'preSync' | 'postSync';

interface HookContext {
  localPath: string;
  remotePath: string;
  host: string;
  protocol: string;
}

// Strip null bytes from values set in the child process environment.
// Null bytes terminate strings in POSIX and can corrupt env entries.
function sanitizeEnvValue(value: string): string {
  return value.replace(/\0/g, '');
}

function runShellCommand(
  command: string,
  ctx: HookContext,
  workspacePath?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      SFTP_LOCAL_PATH: sanitizeEnvValue(ctx.localPath),
      SFTP_REMOTE_PATH: sanitizeEnvValue(ctx.remotePath),
      SFTP_HOST: sanitizeEnvValue(ctx.host),
      SFTP_PROTOCOL: sanitizeEnvValue(ctx.protocol),
    };

    logger.info(`[hook] Running: ${command}`);
    exec(command, { cwd: workspacePath, env, timeout: 30000 }, (error, stdout, stderr) => {
      if (stdout) {
        logger.info(`[hook] stdout: ${stdout.trim()}`);
      }
      if (stderr) {
        logger.warn(`[hook] stderr: ${stderr.trim()}`);
      }
      if (error) {
        logger.error(error, `[hook] Command failed: ${command}`);
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export async function runHook(
  hookType: HookType,
  hooks: Partial<Record<HookType, string>> | undefined,
  ctx: HookContext,
  workspacePath?: string
): Promise<void> {
  if (!hooks) {
    return;
  }
  const command = hooks[hookType];
  if (!command) {
    return;
  }
  try {
    await runShellCommand(command, ctx, workspacePath);
  } catch (error) {
    showErrorMessage(`Hook "${hookType}" failed: ${error.message}`);
    throw error;
  }
}
