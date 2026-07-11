import * as output from '../ui/output';
import logger from '../logger';
import { showErrorMessage } from '../host';

const CONNECTION_ERROR_PATTERNS = [
  /ECONNRESET/i,
  /ECONNREFUSED/i,
  /ETIMEDOUT/i,
  /EPIPE/i,
  /ENOTFOUND/i,
  /ECONNABORTED/i,
  /connection lost/i,
  /connection closed/i,
  /connection ended/i,
  /connection reset/i,
  /connection broken/i,
  /server closed/i,
  /client is closed/i,
  /socket closed/i,
  /no response from server/i,
  /unable to start subsystem/i,
  /ended by server/i,
  /\bfin\b/i,
];

export function isConnectionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') {
    return false;
  }
  const message = (err as Error).message || '';
  const code = (err as { code?: unknown }).code || '';
  const text = `${message} ${code}`;
  return CONNECTION_ERROR_PATTERNS.some(pattern => pattern.test(text));
}

export function reportError(err: Error | string, ctx?: string) {
  let errorString: string;
  if (err instanceof Error) {
    errorString = err.message;
    logger.error(`${err.stack}`, ctx);
  } else {
    errorString = err;
    logger.error(errorString, ctx);
  }

  showErrorMessage(errorString, 'Detail').then(result => {
    if (result === 'Detail') {
      output.show();
    }
  });
  return;
}
