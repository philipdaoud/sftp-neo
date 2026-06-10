import * as crypto from 'crypto';
import * as os from 'os';
import * as path from 'path';
import * as fse from 'fs-extra';

const STORE_PATH = path.join(os.homedir(), '.vscode-sftp', 'known_hosts.json');

type KnownHosts = Record<string, string>; // "host:port" -> sha256 hex fingerprint

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

export async function checkHostKey(
  host: string,
  port: number,
  keyFingerprint: string,
  promptAccept: (fp: string, host: string) => Promise<HostKeyDecision>
): Promise<boolean> {
  const hostKey = `${host}:${port}`;
  const known = await load();

  if (!(hostKey in known)) {
    const decision = await promptAccept(keyFingerprint, host);
    if (decision === 'accept') {
      known[hostKey] = keyFingerprint;
      await save(known);
      return true;
    }
    return false;
  }

  if (known[hostKey] !== keyFingerprint) {
    // Key mismatch — surface to caller as a thrown error so the message is visible
    throw new Error(
      `SSH host key for ${host} has CHANGED.\n` +
      `Stored:   ${known[hostKey]}\n` +
      `Received: ${keyFingerprint}\n` +
      `If this is unexpected, a man-in-the-middle attack may be in progress. ` +
      `To accept the new key, remove the entry from ${STORE_PATH} and reconnect.`
    );
  }

  return true;
}
