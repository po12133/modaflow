import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';

export function isEncryptionKey(key: string | undefined): key is string {
  return typeof key === 'string' && /^[0-9a-fA-F]{64}$/.test(key);
}

export function encryptSecret(plain: string, keyHex: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, Buffer.from(keyHex, 'hex'), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [VERSION, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join(':');
}

export function decryptSecret(blob: string, keyHex: string): string {
  const [version, iv, tag, data] = blob.split(':');
  if (version !== VERSION || !iv || !tag || data === undefined) throw new Error('Unsupported secret format');
  const decipher = createDecipheriv(ALGORITHM, Buffer.from(keyHex, 'hex'), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

export function secretHint(plain: string): string | null {
  return plain.length >= 12 ? plain.slice(-4) : null;
}
