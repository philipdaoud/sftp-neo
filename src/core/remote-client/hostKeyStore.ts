import * as crypto from 'crypto';
import * as os from 'os';
import * as path from 'path';
import * as fse from 'fs-extra';
import logger from '../../logger';

const STORE_PATH = path.join(os.homedir(), '.vscode-sftp', 'known_hosts.json');

type KnownHosts = Record<string, string>; // "host:port[:workspace]" -> sha256 hex fingerprint

async function load(): Promise<KnownHosts> {
  try {
    return await fse.readJson(STORE_PATH);
  } catch {
    return {};
  }
}

async function save(hosts: KnownHosts): Promise<void> {
  await fse.outputJson(STORE_PATH, hosts, { spaces: 2 });
}

export function fingerprint(keyBuffer: Buffer): string {
  return crypto.createHash('sha256').update(keyBuffer).digest('hex');
}

// OpenSSH display form (`ssh-keygen -lf`), so users can compare out of band.
export function openSshFingerprint(hexFingerprint: string): string {
  return `SHA256:${Buffer.from(hexFingerprint, 'hex').toString('base64').replace(/=+$/, '')}`;
}

export type HostKeyDecision = 'accept' | 'reject';

// 'accept-new' trusts unknown keys without asking (OpenSSH StrictHostKeyChecking
// accept-new); a changed key always needs the user's decision.
export type HostKeyChecking = 'strict' | 'accept-new';

export interface HostKeyCheckOptions {
  mode?: HostKeyChecking;
  promptChanged?: (stored: string, received: string, host: string) => Promise<HostKeyDecision>;
}

function makeHostKey(host: string, port: number, workspace?: string): string {
  return workspace ? `${host}:${port}:${workspace}` : `${host}:${port}`;
}

export async function checkHostKey(
  host: string,
  port: number,
  keyFingerprint: string,
  promptAccept: (fp: string, host: string) => Promise<HostKeyDecision>,
  workspace?: string,
  options: HostKeyCheckOptions = {}
): Promise<boolean> {
  const hostKey = makeHostKey(host, port, workspace);
  const legacyHostKey = makeHostKey(host, port);
  const known = await load();

  // A declined (or unpromptable) change surfaces to the caller as a thrown error.
  const handleChanged = async (stored: string): Promise<boolean> => {
    const decision = options.promptChanged
      ? await options.promptChanged(stored, keyFingerprint, host)
      : 'reject';
    if (decision !== 'accept') {
      throw new Error(
        `SSH host key for ${host} has CHANGED.\n` +
        `Stored:   ${openSshFingerprint(stored)}\n` +
        `Received: ${openSshFingerprint(keyFingerprint)}\n` +
        `If this is unexpected, a man-in-the-middle attack may be in progress. ` +
        `To accept the new key, reconnect and choose "Accept New Key", or remove the entry from ${STORE_PATH}.`
      );
    }
    known[hostKey] = keyFingerprint;
    await save(known);
    logger.info(`Replaced changed SSH host key for ${hostKey} (${openSshFingerprint(keyFingerprint)}).`);
    return true;
  };

  // 1. Prefer workspace-scoped entry.
  const scopedEntry = known[hostKey];
  if (scopedEntry !== undefined) {
    if (scopedEntry === keyFingerprint) {
      return true;
    }
    return handleChanged(scopedEntry);
  }

  // 2. Fall back to legacy host:port entry for migration.
  const legacyEntry = known[legacyHostKey];
  if (legacyEntry !== undefined) {
    if (legacyEntry === keyFingerprint) {
      // Migrate to workspace-scoped key silently so existing users aren't prompted again.
      known[hostKey] = keyFingerprint;
      await save(known);
      return true;
    }
    // Legacy key exists but doesn't match. Don't trust it for this workspace;
    // treat as unknown and let the user decide — except that accept-new must not
    // silently accept a key that differs from one already on record.
    if (options.mode === 'accept-new') {
      return handleChanged(legacyEntry);
    }
  }

  // 3. Unknown host key.
  if (options.mode === 'accept-new') {
    known[hostKey] = keyFingerprint;
    await save(known);
    logger.info(`Accepted new SSH host key for ${hostKey} (${openSshFingerprint(keyFingerprint)}) — hostKeyChecking is "accept-new".`);
    return true;
  }
  const decision = await promptAccept(keyFingerprint, host);
  if (decision === 'accept') {
    known[hostKey] = keyFingerprint;
    await save(known);
    return true;
  }
  return false;
}
