import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PUBLIC_CODE_PATTERN } from './storefront-rules.js';
import { contractedRules, effectiveStatus, isFeatureEnabled } from '../subscriptions/entitlement-rules.js';
import { EntitlementsService } from '../subscriptions/entitlements.service.js';

export interface PublicStoreContext {
  tenantId: string;
  storeId: string;
  slug: string;
  name: string;
  description: string | null;
  city: string;
  address: string | null;
  whatsapp: string;
  primaryColor: string;
  secondaryColor: string;
  welcomeMessage: string | null;
  hideOutOfStock: boolean;
  logoKey: string | null;
  coverKey: string | null;
}

@Injectable()
export class StorefrontAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async isOnline(tenantId: string, now = new Date()): Promise<boolean> {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId }, include: { plan: true, planVersion: true } });
    if (!sub) return false;
    return isFeatureEnabled(contractedRules(sub), effectiveStatus(sub, now), 'onlineCatalog');
  }

  async assertManage(tenantId: string): Promise<void> {
    await this.entitlements.assertFeature(tenantId, 'onlineCatalog');
  }

  async resolvePublic(slug: string): Promise<PublicStoreContext> {
    const where = PUBLIC_CODE_PATTERN.test(slug) ? { publicCode: slug } : { slug };
    const store = await this.prisma.store.findUnique({ where, include: { catalogSettings: true } });
    const settings = store?.catalogSettings;
    if (!store || settings?.status === 'HIDDEN' || !(await this.isOnline(store.tenantId))) {
      throw new AppError(HttpStatus.NOT_FOUND, 'CATALOG_UNAVAILABLE', 'Este catálogo no está disponible.');
    }
    return {
      tenantId: store.tenantId,
      storeId: store.id,
      slug: store.slug,
      name: store.name,
      description: store.description,
      city: store.city,
      address: store.address,
      whatsapp: store.whatsapp,
      primaryColor: store.primaryColor,
      secondaryColor: settings?.secondaryColor ?? '#FF5C8A',
      welcomeMessage: settings?.welcomeMessage ?? null,
      hideOutOfStock: settings?.outOfStock === 'HIDE',
      logoKey: settings?.logoKey ?? null,
      coverKey: settings?.coverKey ?? null,
    };
  }
}
