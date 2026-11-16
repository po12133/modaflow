import { backupFileName, decryptBackup, encryptBackup, packBackup, pgConnection, unpackBackup, type BackupManifest } from './backup-format.js';

const KEY = 'a'.repeat(64);
const manifest: BackupManifest = {
  format: 1,
  createdAt: '2026-11-16T05:00:00.000Z',
  createdBy: 'admin@equipo.test',
  database: { name: 'modaflow', bytes: 5, tool: 'pg_dump 18' },
  files: { count: 1, bytes: 10, prefix: 'modaflow/', items: [{ key: 'tenants/x/a.webp', size: 10, lastModified: null }] },
};

describe('backup format', () => {
  it('round-trips manifest and database dump through encryption', () => {
    const file = encryptBackup(packBackup(manifest, Buffer.from('DUMP!')), KEY);
    expect(file.includes(Buffer.from('tenants/x'))).toBe(false);
    const { manifest: m, dump } = unpackBackup(decryptBackup(file, KEY));
    expect(m).toEqual(manifest);
    expect(dump.toString()).toBe('DUMP!');
  });

  it('rejects a wrong key, a tampered file and foreign files', () => {
    const file = encryptBackup(packBackup(manifest, Buffer.from('DUMP!')), KEY);
    expect(() => decryptBackup(file, 'b'.repeat(64))).toThrow();
    const tampered = Buffer.from(file);
    tampered[20] = tampered[20]! ^ 1;
    expect(() => decryptBackup(tampered, KEY)).toThrow();
    expect(() => decryptBackup(Buffer.from('hola mundo, no soy un backup'), KEY)).toThrow('Not a ModaFlow backup file');
  });

  it('names files and builds pg_dump connections without the Prisma query string', () => {
    expect(backupFileName(new Date('2026-11-16T05:07:09Z'))).toBe('modaflow-backup-20261116-0507.mfbackup');
    expect(pgConnection('postgresql://modaflow_admin:secret@postgres:5432/modaflow?schema=public', 'modaflow_backup')).toEqual({
      host: 'postgres',
      port: '5432',
      database: 'modaflow',
      user: 'modaflow_backup',
    });
  });
});
