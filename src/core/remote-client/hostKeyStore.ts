import * as crypto from 'crypto';
import * as os from 'os';
import * as path from 'path';
import * as fse from 'fs-extra';

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

export type HostKeyDecision = 'accept' | 'reject';

function makeHostKey(host: string, port: number, workspace?: string): string {
  return workspace ? `${host}:${port}:${workspace}` : `${host}:${port}`;
}

export async function checkHostKey(
  host: string,
  port: number,
  keyFingerprint: string,
  promptAccept: (fp: string, host: string) => Promise<HostKeyDecision>,
  workspace?: string
): Promise<boolean> {
  const hostKey = makeHostKey(host, port, workspace);
  const legacyHostKey = makeHostKey(host, port);
  const known = await load();

  // 1. Prefer workspace-scoped entry.
  const scopedEntry = known[hostKey];
  if (scopedEntry !== undefined) {
    if (scopedEntry === keyFingerprint) {
      return true;
    }
    // Key mismatch for this workspace — surface to caller as a thrown error.
    throw new Error(
      `SSH host key for ${host} has CHANGED.\n` +
      `Stored:   ${scopedEntry}\n` +
      `Received: ${keyFingerprint}\n` +
      `If this is unexpected, a man-in-the-middle attack may be in progress. ` +
      `To accept the new key, remove the entry from ${STORE_PATH} and reconnect.`
    );
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
    // treat as unknown and let the user decide.
  }

  // 3. Unknown host key — prompt the user.
  const decision = await promptAccept(keyFingerprint, host);
  if (decision === 'accept') {
    known[hostKey] = keyFingerprint;
    await save(known);
    return true;
  }
  return false;
}
