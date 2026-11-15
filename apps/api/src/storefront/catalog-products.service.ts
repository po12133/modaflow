import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import type { Prisma } from '../generated/prisma/client.js';
import { ImagesService } from '../images/images.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { BulkPublishDto, CatalogProductsQueryDto } from './dto/settings.dto.js';
import { StorefrontAccessService } from './storefront-access.service.js';

@Injectable()
export class CatalogProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly images: ImagesService,
    private readonly access: StorefrontAccessService,
  ) {}

  async list(tenantId: string, q: CatalogProductsQueryDto) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const search = q.search?.trim();
    const where: Prisma.ProductWhereInput = {
      tenantId,
      status: 'ACTIVE',
      ...(q.visibility ? { catalogPublished: q.visibility === 'published' } : {}),
      ...(search
        ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { sku: { contains: search, mode: 'insensitive' } }] }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          sku: true,
          slug: true,
          salePrice: true,
          totalStock: true,
          catalogPublished: true,
          category: { select: { name: true } },
          images: { where: { isPrimary: true }, take: 1 },
        },
      }),
      this.prisma.product.count({ where }),
    ]);
    const items = await Promise.all(
      rows.map(async (p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        slug: p.slug,
        salePrice: p.salePrice.toFixed(2),
        totalStock: p.totalStock,
        catalogPublished: p.catalogPublished,
        category: p.category?.name ?? null,
        thumbUrl: p.images[0] ? (await this.images.toView(p.images[0])).thumbUrl : null,
      })),
    );
    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async setPublished(tenantId: string, id: string, catalogPublished: boolean) {
    await this.access.assertManage(tenantId);
    const result = await this.prisma.product.updateMany({ where: { id, tenantId, status: 'ACTIVE' }, data: { catalogPublished } });
    if (result.count === 0) throw new AppError(HttpStatus.NOT_FOUND, 'PRODUCT_NOT_FOUND', 'No se encontró el producto.');
    return { id, catalogPublished };
  }

  async bulk(tenantId: string, dto: BulkPublishDto) {
    await this.access.assertManage(tenantId);
    const result = await this.prisma.product.updateMany({
      where: { tenantId, id: { in: dto.ids }, status: 'ACTIVE' },
      data: { catalogPublished: dto.catalogPublished },
    });
    return { updated: result.count, catalogPublished: dto.catalogPublished };
  }

  async summary(tenantId: string) {
    const active = { tenantId, status: 'ACTIVE' as const };
    const [published, hidden, publishedOutOfStock, requests, pendingRequests] = await this.prisma.$transaction([
      this.prisma.product.count({ where: { ...active, catalogPublished: true } }),
      this.prisma.product.count({ where: { ...active, catalogPublished: false } }),
      this.prisma.product.count({ where: { ...active, catalogPublished: true, totalStock: 0 } }),
      this.prisma.catalogOrderRequest.count({ where: { tenantId } }),
      this.prisma.catalogOrderRequest.count({ where: { tenantId, status: { in: ['CREATED', 'WHATSAPP_OPENED'] } } }),
    ]);
    return { published, hidden, publishedOutOfStock, requests, pendingRequests };
  }
}
