import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { coreImports } from '../app-core.js';
import { validateAdminEnv } from '../admin/admin-env.js';
import { decryptBackup, unpackBackup } from '../admin/backups/backup-format.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';

const USAGE = `Uso:
  backup open <id-del-backup | archivo.mfbackup> <carpeta>
    Descifra el backup (desde el S3 por su id, o un archivo local) y escribe en la carpeta:
      database.dump  -> para pg_restore
      manifest.json  -> fecha, autor e inventario de archivos del bucket`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Module({ imports: coreImports(validateAdminEnv) })
class BackupCliModule {}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function fromStorage(id: string): Promise<Buffer> {
  const app = await NestFactory.createApplicationContext(BackupCliModule, { logger: ['error', 'warn'] });
  try {
    const row = await app.get(PrismaService).backup.findUnique({ where: { id }, select: { status: true, storageKey: true } });
    if (!row?.storageKey || row.status !== 'COMPLETED') fail('No hay un backup completo con ese id.');
    return await app.get(StorageService).get(row.storageKey);
  } finally {
    await app.close();
  }
}

async function main() {
  const [command, source, target] = process.argv.slice(2);
  if (command !== 'open' || !source || !target) fail(USAGE);
  const key = process.env['BACKUP_ENCRYPTION_KEY'];
  if (!key) fail('Falta BACKUP_ENCRYPTION_KEY en el entorno.');
  const file = UUID.test(source) ? await fromStorage(source) : await readFile(resolve(source));
  const { manifest, dump } = unpackBackup(decryptBackup(file, key));
  const dir = resolve(target);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'database.dump'), dump, { mode: 0o600 });
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600 });
  console.log(`Backup del ${manifest.createdAt} (${manifest.createdBy}) descifrado en ${dir}`);
  console.log(`Base de datos: ${manifest.database.bytes} bytes · Archivos en el bucket: ${manifest.files.count}`);
  console.log('Para restaurar, sigue la sección "Backups" del README (pg_restore). Borra la carpeta al terminar.');
}

main().catch((error: unknown) => fail(`[backup] ${error instanceof Error ? error.message : String(error)}`));
