import { BaseAgent, utils } from 'ssh2';

const OPENSSH_PRIVATE_KEY = /-----BEGIN OPENSSH PRIVATE KEY-----([\s\S]+?)-----END OPENSSH PRIVATE KEY-----/;
const OPENSSH_MAGIC = 'openssh-key-v1\0';

// The openssh-key-v1 header stores the public key in clear text even when the
// private part is encrypted, so the key can be matched without a passphrase.
function readOpenSshHeaderPublicKey(keyData: string): Buffer | undefined {
  const match = OPENSSH_PRIVATE_KEY.exec(keyData);
  if (!match) {
    return undefined;
  }

  const data = Buffer.from(match[1].replace(/\s+/g, ''), 'base64');
  if (data.toString('latin1', 0, OPENSSH_MAGIC.length) !== OPENSSH_MAGIC) {
    return undefined;
  }

  let pos = OPENSSH_MAGIC.length;
  const readString = (): Buffer | undefined => {
    if (pos + 4 > data.length) {
      return undefined;
    }
    const len = data.readUInt32BE(pos);
    pos += 4;
    if (pos + len > data.length) {
      return undefined;
    }
    const value = data.subarray(pos, pos + len);
    pos += len;
    return value;
  };

  // cipher name, kdf name, kdf options
  for (let i = 0; i < 3; i++) {
    if (readString() === undefined) {
      return undefined;
    }
  }
  if (pos + 4 > data.length || data.readUInt32BE(pos) < 1) {
    return undefined;
  }
  pos += 4;
  return readString();
}

function toPublicBlob(key: any): Buffer | undefined {
  const parsed = utils.parseKey(key);
  if (!parsed || parsed instanceof Error) {
    return undefined;
  }
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  return first ? first.getPublicSSH() : undefined;
}

/**
 * Public key blob (SSH wire format) for a private key file, from the
 * openssh-key-v1 header, the `.pub` file content, or an unencrypted key.
 */
export function getPublicKeyBlob(keyData: string, pubKeyData?: string): Buffer | undefined {
  const fromHeader = readOpenSshHeaderPublicKey(keyData);
  if (fromHeader) {
    return fromHeader;
  }
  if (pubKeyData) {
    const fromPub = toPublicBlob(pubKeyData);
    if (fromPub) {
      return fromPub;
    }
  }
  return toPublicBlob(keyData);
}

/**
 * Wraps an agent so the identity matching `publicKey` is offered first, or
 * alone when `identitiesOnly` is set. Without this every agent key is tried
 * and servers with a low MaxAuthTries reject the connection.
 */
export class SelectiveAgent extends BaseAgent {
  constructor(
    private readonly agent: any,
    private readonly publicKey: Buffer,
    private readonly identitiesOnly: boolean
  ) {
    super();
  }

  getIdentities(cb: (err: Error | null, keys?: any[]) => void) {
    this.agent.getIdentities((err, keys) => {
      if (err) {
        return cb(err);
      }
      const matching: any[] = [];
      const others: any[] = [];
      for (const key of keys || []) {
        const blob = toPublicBlob(key);
        (blob && blob.equals(this.publicKey) ? matching : others).push(key);
      }
      cb(null, this.identitiesOnly ? matching : matching.concat(others));
    });
  }

  sign(...args: any[]) {
    this.agent.sign(...args);
  }
}

export function agentHasIdentity(agent: any, publicKey: Buffer): Promise<boolean> {
  return new Promise((resolve, reject) => {
    agent.getIdentities((err, keys) => {
      if (err) {
        return reject(err);
      }
      resolve((keys || []).some(key => {
        const blob = toPublicBlob(key);
        return !!blob && blob.equals(publicKey);
      }));
    });
  });
}
