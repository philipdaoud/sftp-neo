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
  // Set only from the machine-scoped `sftp.skipHostKeyVerification` setting,
  // never from sftp.json, so a cloned workspace can't turn verification off.
  skipVerification?: boolean;
  promptChanged?: (stored: string, received: string, host: string) => Promise<HostKeyDecision>;
}

function parseHostPattern(pattern: string): { host: string; port?: number } {
  const bracketed = /^\[(.+)\]:(\d+)$/.exec(pattern);
  if (bracketed) {
    return { host: bracketed[1], port: parseInt(bracketed[2], 10) };
  }
  // A single colon followed by digits is a port; more colons mean a bare IPv6 address.
  const withPort = /^([^:]+):(\d+)$/.exec(pattern);
  if (withPort) {
    return { host: withPort[1], port: parseInt(withPort[2], 10) };
  }
  return { host: pattern };
}

// A pattern made only of wildcards would disable verification for every host,
// which defeats the point of an explicit host list.
export function isUnrestrictedHostPattern(pattern: string): boolean {
  return /^[*?]*$/.test(parseHostPattern(pattern.trim()).host);
}

export function matchesHostPattern(host: string, port: number, patterns: string[]): boolean {
  return patterns.some(raw => {
    const pattern = typeof raw === 'string' ? raw.trim() : '';
    if (!pattern || isUnrestrictedHostPattern(pattern)) {
      return false;
    }
    const parsed = parseHostPattern(pattern);
    if (parsed.port !== undefined && parsed.port !== port) {
      return false;
    }
    const source = parsed.host
      .split('')
      .map(c => (c === '*' ? '.*' : c === '?' ? '.' : c.replace(/[.+^${}()|[\]\\]/g, '\\$&')))
      .join('');
    return new RegExp(`^${source}$`, 'i').test(host);
  });
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

  if (options.skipVerification) {
    logger.warn(
      `SSH host key verification skipped for ${host}:${port} (sftp.skipHostKeyVerification). ` +
      `Received ${openSshFingerprint(keyFingerprint)}; it was not checked or stored.`
    );
    return true;
  }

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
