import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { PlatformSettings, Prisma } from '../../generated/prisma/client.js';
import { imageKeys, processProductImage } from '../../images/image-processing.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StorageService } from '../../storage/storage.service.js';
import type { UpdatePlatformSettingsDto } from './dto/settings.dto.js';

@Injectable()
export class PlatformSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<PlatformSettings> {
    return this.prisma.platformSettings.findUniqueOrThrow({ where: { id: 1 } });
  }

  async view() {
    const s = await this.get();
    return { ...s, qrImageUrl: await this.qrUrl(s.qrImageKey) };
  }

  async update(dto: UpdatePlatformSettingsDto, actorId: string, ip: string | null) {
    const before = await this.get();
    const data: Prisma.PlatformSettingsUpdateInput = Object.assign({ updatedById: actorId }, dto);
    const after = await this.prisma.platformSettings.update({ where: { id: 1 }, data });
    const changed = Object.keys(dto) as (keyof PlatformSettings)[];
    await this.audit.record({
      actorId,
      action: 'SETTINGS_UPDATED',
      entityType: 'PlatformSettings',
      entityId: '1',
      before: Object.fromEntries(changed.map((k) => [k, before[k]])),
      after: Object.fromEntries(changed.map((k) => [k, after[k]])),
      ip,
    });
    return this.view();
  }

  async uploadQr(file: Buffer, actorId: string, ip: string | null) {
    this.storage.assertConfigured();
    const processed = await processProductImage(file);
    const key = `platform/payments/qr-${randomUUID()}`;
    const keys = imageKeys(key);
    await this.storage.put(keys.main, processed.main, processed.contentType);
    await this.storage.put(keys.thumb, processed.thumb, processed.contentType);
    const before = await this.get();
    await this.prisma.platformSettings.update({ where: { id: 1 }, data: { qrImageKey: key, updatedById: actorId } });
    await this.audit.record({ actorId, action: 'PAYMENT_QR_UPDATED', entityType: 'PlatformSettings', entityId: '1', before: { qrImageKey: before.qrImageKey }, after: { qrImageKey: key }, ip });
    return this.view();
  }

  private async qrUrl(key: string | null): Promise<string | null> {
    if (!key) return null;
    try {
      return await this.storage.fileUrl(imageKeys(key).main);
    } catch {
      return null;
    }
  }
}
