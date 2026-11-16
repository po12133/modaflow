import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../../common/app-error.js';
import { imageKeys, processProductImage } from '../../images/image-processing.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StorageService } from '../../storage/storage.service.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class PlanPaymentQrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const plans = await this.prisma.plan.findMany({
      where: { isTrial: false, priceCents: { gt: 0 } },
      orderBy: { sortOrder: 'asc' },
      select: { code: true, name: true, priceCents: true, currency: true, billingPeriod: true, isActive: true, paymentQrKey: true },
    });
    return Promise.all(plans.map(async ({ paymentQrKey, ...p }) => ({ ...p, qrImageUrl: await this.url(paymentQrKey) })));
  }

  async upload(code: string, file: Buffer, actorId: string, ip: string | null) {
    const plan = await this.payable(code);
    this.storage.assertConfigured();
    const processed = await processProductImage(file);
    const key = `platform/payments/qr-${plan.code}-${randomUUID()}`;
    const keys = imageKeys(key);
    await this.storage.put(keys.main, processed.main, processed.contentType);
    await this.storage.put(keys.thumb, processed.thumb, processed.contentType);
    await this.prisma.plan.update({ where: { id: plan.id }, data: { paymentQrKey: key } });
    await this.audit.record({ actorId, action: 'PLAN_PAYMENT_QR_UPDATED', entityType: 'Plan', entityId: plan.id, before: { paymentQrKey: plan.paymentQrKey }, after: { paymentQrKey: key }, ip });
    await this.discard(plan.paymentQrKey);
    return this.list();
  }

  async remove(code: string, actorId: string, ip: string | null) {
    const plan = await this.payable(code);
    if (!plan.paymentQrKey) return this.list();
    await this.prisma.plan.update({ where: { id: plan.id }, data: { paymentQrKey: null } });
    await this.audit.record({ actorId, action: 'PLAN_PAYMENT_QR_REMOVED', entityType: 'Plan', entityId: plan.id, before: { paymentQrKey: plan.paymentQrKey }, after: { paymentQrKey: null }, ip });
    await this.discard(plan.paymentQrKey);
    return this.list();
  }

  private async payable(code: string) {
    const plan = await this.prisma.plan.findUnique({ where: { code }, select: { id: true, code: true, isTrial: true, priceCents: true, paymentQrKey: true } });
    if (!plan || plan.isTrial || plan.priceCents <= 0) throw new AppError(HttpStatus.NOT_FOUND, 'PLAN_NOT_FOUND', 'Ese plan no se cobra con QR.');
    return plan;
  }

  private async discard(key: string | null) {
    if (key) await this.storage.deleteMany(Object.values(imageKeys(key))).catch(() => undefined);
  }

  private async url(key: string | null): Promise<string | null> {
    if (!key) return null;
    return this.storage.fileUrl(imageKeys(key).main).catch(() => null);
  }
}
