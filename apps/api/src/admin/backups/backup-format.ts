import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const MAGIC = Buffer.from('MFBK1\n', 'utf8');
const IV_BYTES = 12;
const TAG_BYTES = 16;

export const BACKUP_EXTENSION = '.mfbackup';

export interface StoredFile {
  key: string;
  size: number;
  lastModified: string | null;
}

export interface BackupManifest {
  format: 1;
  createdAt: string;
  createdBy: string;
  database: { name: string; bytes: number; tool: string };
  files: { count: number; bytes: number; prefix: string; items: StoredFile[] };
}

function keyBuffer(hex: string): Buffer {
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) throw new Error('BACKUP_ENCRYPTION_KEY must be 64 hex characters');
  return key;
}

export function packBackup(manifest: BackupManifest, dump: Buffer): Buffer {
  const head = Buffer.from(JSON.stringify(manifest), 'utf8');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(head.length);
  return Buffer.concat([length, head, dump]);
}

export function unpackBackup(plain: Buffer): { manifest: BackupManifest; dump: Buffer } {
  const length = plain.readUInt32BE(0);
  const manifest = JSON.parse(plain.subarray(4, 4 + length).toString('utf8')) as BackupManifest;
  return { manifest, dump: plain.subarray(4 + length) };
}

export function encryptBackup(plain: Buffer, keyHex: string): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', keyBuffer(keyHex), iv);
  cipher.setAAD(MAGIC);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, iv, body, cipher.getAuthTag()]);
}

export function decryptBackup(file: Buffer, keyHex: string): Buffer {
  if (file.length < MAGIC.length + IV_BYTES + TAG_BYTES || !file.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error('Not a ModaFlow backup file');
  }
  const iv = file.subarray(MAGIC.length, MAGIC.length + IV_BYTES);
  const tag = file.subarray(file.length - TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', keyBuffer(keyHex), iv);
  decipher.setAAD(MAGIC);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(file.subarray(MAGIC.length + IV_BYTES, file.length - TAG_BYTES)), decipher.final()]);
}

export function backupFileName(startedAt: Date): string {
  const stamp = startedAt.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
  return `modaflow-backup-${stamp}${BACKUP_EXTENSION}`;
}

export function pgConnection(databaseUrl: string, user: string) {
  const url = new URL(databaseUrl);
  return { host: url.hostname, port: url.port || '5432', database: decodeURIComponent(url.pathname.slice(1)), user };
}
