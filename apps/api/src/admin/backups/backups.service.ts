import { HttpStatus, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppError } from '../../common/app-error.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StorageService } from '../../storage/storage.service.js';
import type { AdminEnvironmentVariables } from '../admin-env.js';
import { AuditService } from '../audit/audit.service.js';
import { backupFileName, decryptBackup, encryptBackup, packBackup, unpackBackup } from './backup-format.js';
import { pgDump, pgDumpVersion } from './backup-runner.js';

const SELECT = {
  id: true, status: true, source: true, sizeBytes: true, databaseBytes: true, fileCount: true, filesBytes: true,
  errorMessage: true, startedAt: true, finishedAt: true, storageKey: true, createdBy: { select: { name: true, email: true } },
} as const;
const storageKeyFor = (id: string) => `backups/${id}.mfbackup`;
const num = (v: bigint | null) => (v === null ? null : Number(v));

@Injectable()
export class BackupsService implements OnModuleInit {
  private readonly logger = new Logger(BackupsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<AdminEnvironmentVariables, true>,
  ) {}

  async onModuleInit() {
    await this.prisma.backup.updateMany({ where: { status: 'RUNNING' }, data: { status: 'FAILED', errorMessage: 'Interrumpido por un reinicio del servidor.', finishedAt: new Date() } });
  }

  readiness() {
    return {
      database: Boolean(this.config.get('BACKUP_DB_PASSWORD', { infer: true })),
      encryption: Boolean(this.config.get('BACKUP_ENCRYPTION_KEY', { infer: true })),
      storage: this.storage.isConfigured,
    };
  }

  async list() {
    const rows = await this.prisma.backup.findMany({ orderBy: { startedAt: 'desc' }, take: 100, select: SELECT });
    return { ready: this.readiness(), items: rows.map(({ storageKey, ...r }) => ({ ...r, sizeBytes: num(r.sizeBytes), databaseBytes: num(r.databaseBytes), filesBytes: num(r.filesBytes), downloadable: r.status === 'COMPLETED' && Boolean(storageKey) })) };
  }

  async start(staffId: string, ip: string | null) {
    const ready = this.readiness();
    if (!ready.database || !ready.encryption || !ready.storage) {
      throw new AppError(HttpStatus.SERVICE_UNAVAILABLE, 'BACKUP_NOT_CONFIGURED', 'Faltan BACKUP_DB_PASSWORD, BACKUP_ENCRYPTION_KEY o el almacenamiento S3.');
    }
    if (await this.prisma.backup.count({ where: { status: 'RUNNING' } })) throw new AppError(HttpStatus.CONFLICT, 'BACKUP_RUNNING', 'Ya hay un backup en curso.');
    const row = await this.prisma.backup.create({ data: { createdById: staffId }, select: { id: true, createdBy: { select: { email: true } } } });
    await this.audit.record({ actorId: staffId, action: 'BACKUP_CREATED', entityType: 'Backup', entityId: row.id, ip });
    void this.run(row.id, row.createdBy.email);
    return { id: row.id };
  }

  async import(file: Buffer, staffId: string, ip: string | null) {
    const key = this.config.get('BACKUP_ENCRYPTION_KEY', { infer: true });
    if (!key) throw new AppError(HttpStatus.SERVICE_UNAVAILABLE, 'BACKUP_NOT_CONFIGURED', 'Falta BACKUP_ENCRYPTION_KEY en el servidor.');
    this.storage.assertConfigured();
    let manifest;
    try {
      ({ manifest } = unpackBackup(decryptBackup(file, key)));
    } catch {
      throw new AppError(HttpStatus.BAD_REQUEST, 'INVALID_BACKUP', 'El archivo no es un backup de ModaFlow o se cifró con otra clave.');
    }
    const row = await this.prisma.backup.create({ data: { createdById: staffId, source: 'IMPORTED', startedAt: new Date(manifest.createdAt) }, select: { id: true } });
    await this.storage.put(storageKeyFor(row.id), file, 'application/octet-stream');
    await this.prisma.backup.update({
      where: { id: row.id },
      data: { status: 'COMPLETED', storageKey: storageKeyFor(row.id), sizeBytes: file.length, databaseBytes: manifest.database.bytes, fileCount: manifest.files.count, filesBytes: manifest.files.bytes, finishedAt: new Date() },
    });
    await this.audit.record({ actorId: staffId, action: 'BACKUP_IMPORTED', entityType: 'Backup', entityId: row.id, after: { createdAt: manifest.createdAt, bytes: file.length }, ip });
    return { id: row.id };
  }

  async download(id: string, staffId: string, ip: string | null) {
    const row = await this.ready(id);
    const url = await this.storage.downloadUrl(row.storageKey!, backupFileName(row.startedAt));
    await this.audit.record({ actorId: staffId, action: 'BACKUP_DOWNLOADED', entityType: 'Backup', entityId: id, ip });
    return { url, fileName: backupFileName(row.startedAt) };
  }

  async fetchFile(id: string): Promise<Buffer> {
    const row = await this.ready(id);
    return this.storage.get(row.storageKey!);
  }

  async remove(id: string, staffId: string, ip: string | null) {
    const row = await this.prisma.backup.findUnique({ where: { id }, select: { status: true, storageKey: true, startedAt: true } });
    if (!row) throw new AppError(HttpStatus.NOT_FOUND, 'BACKUP_NOT_FOUND', 'Backup no encontrado.');
    if (row.status === 'RUNNING') throw new AppError(HttpStatus.CONFLICT, 'BACKUP_RUNNING', 'Espera a que termine el backup.');
    if (row.storageKey) await this.storage.deleteMany([row.storageKey]);
    await this.prisma.backup.delete({ where: { id } });
    await this.audit.record({ actorId: staffId, action: 'BACKUP_DELETED', entityType: 'Backup', entityId: id, before: { startedAt: row.startedAt.toISOString() }, ip });
  }

  private async ready(id: string) {
    const row = await this.prisma.backup.findUnique({ where: { id }, select: { status: true, storageKey: true, startedAt: true } });
    if (!row) throw new AppError(HttpStatus.NOT_FOUND, 'BACKUP_NOT_FOUND', 'Backup no encontrado.');
    if (row.status !== 'COMPLETED' || !row.storageKey) throw new AppError(HttpStatus.CONFLICT, 'BACKUP_NOT_READY', 'Ese backup no está disponible.');
    return row;
  }

  private async run(id: string, createdBy: string) {
    try {
      const [inventory, dump, tool] = await Promise.all([
        this.storage.listAll(),
        pgDump(this.config.get('DATABASE_URL', { infer: true }), this.config.get('BACKUP_DB_PASSWORD', { infer: true })!),
        pgDumpVersion(),
      ]);
      const items = inventory.items.filter((f) => !f.key.startsWith('backups/'));
      const filesBytes = items.reduce((s, f) => s + f.size, 0);
      const startedAt = new Date();
      const manifest = {
        format: 1 as const, createdAt: startedAt.toISOString(), createdBy,
        database: { name: new URL(this.config.get('DATABASE_URL', { infer: true })).pathname.slice(1), bytes: dump.length, tool },
        files: { count: items.length, bytes: filesBytes, prefix: inventory.prefix, items },
      };
      const file = encryptBackup(packBackup(manifest, dump), this.config.get('BACKUP_ENCRYPTION_KEY', { infer: true })!);
      await this.storage.put(storageKeyFor(id), file, 'application/octet-stream');
      await this.prisma.backup.update({
        where: { id },
        data: { status: 'COMPLETED', storageKey: storageKeyFor(id), sizeBytes: file.length, databaseBytes: dump.length, fileCount: items.length, filesBytes, finishedAt: new Date() },
      });
      this.logger.log(`Backup ${id} completed (${file.length} bytes)`);
    } catch (error) {
      const message = (error as Error).message.replace(/password[^ ]*/gi, '***').slice(0, 500);
      this.logger.error(`Backup ${id} failed: ${message}`);
      await this.prisma.backup.update({ where: { id }, data: { status: 'FAILED', errorMessage: message, finishedAt: new Date() } }).catch(() => undefined);
    }
  }
}
