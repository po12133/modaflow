import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { contractedRules, effectiveStatus, isFeatureEnabled } from '../subscriptions/entitlement-rules.js';
import { CatalogSettingsService } from './catalog-settings.service.js';
import { StorefrontAccessService } from './storefront-access.service.js';

const SITEMAP_PRODUCT_LIMIT = 5000;

@Injectable()
export class PublicStoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: StorefrontAccessService,
    private readonly settings: CatalogSettingsService,
  ) {}

  async store(slug: string) {
    const s = await this.access.resolvePublic(slug);
    const [logoUrl, coverUrl] = await Promise.all([this.settings.url(s.logoKey, 'thumb'), this.settings.url(s.coverKey)]);
    return {
      slug: s.slug,
      name: s.name,
      description: s.description,
      city: s.city,
      address: s.address,
      whatsapp: s.whatsapp,
      primaryColor: s.primaryColor,
      secondaryColor: s.secondaryColor,
      logoUrl,
      coverUrl,
    };
  }

  async sitemap() {
    const now = new Date();
    const stores = await this.prisma.store.findMany({
      where: { OR: [{ catalogSettings: null }, { catalogSettings: { status: 'PUBLISHED' } }] },
      select: { tenantId: true, slug: true, updatedAt: true, tenant: { select: { subscription: { include: { plan: true, planVersion: true } } } } },
    });
    const online = stores.filter((s) => {
      const sub = s.tenant.subscription;
      return sub ? isFeatureEnabled(contractedRules(sub), effectiveStatus(sub, now), 'onlineCatalog') : false;
    });
    const products = await this.prisma.product.findMany({
      where: { tenantId: { in: online.map((s) => s.tenantId) }, status: 'ACTIVE', catalogPublished: true },
      orderBy: { updatedAt: 'desc' },
      take: SITEMAP_PRODUCT_LIMIT,
      select: { tenantId: true, slug: true, updatedAt: true },
    });
    const slugByTenant = new Map(online.map((s) => [s.tenantId, s.slug]));
    return {
      stores: online.map((s) => ({ slug: s.slug, updatedAt: s.updatedAt })),
      products: products.map((p) => ({ store: slugByTenant.get(p.tenantId)!, slug: p.slug, updatedAt: p.updatedAt })),
    };
  }
}
