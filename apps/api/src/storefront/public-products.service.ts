import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import { ImagesService } from '../images/images.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PublicProductsQueryDto } from './dto/public.dto.js';
import { publicProductOrder, publicProductWhere } from './public-filters.js';
import { StorefrontAccessService, type PublicStoreContext } from './storefront-access.service.js';
import { PUBLIC_STOCK_CAP, toSlug } from './storefront-rules.js';

const sizesOf = (variants: { size: string | null; stock: number }[]) => [
  ...new Set(variants.filter((v) => v.stock > 0 && v.size).map((v) => v.size!)),
];

@Injectable()
export class PublicProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly images: ImagesService,
    private readonly access: StorefrontAccessService,
  ) {}

  async categories(slug: string) {
    const store = await this.access.resolvePublic(slug);
    const where = publicProductWhere(store, {}, undefined);
    const groups = await this.prisma.product.groupBy({ by: ['categoryId'], where: { ...where, categoryId: { not: null } }, _count: true });
    const ids = groups.map((g) => g.categoryId!);
    const cats = await this.prisma.category.findMany({ where: { tenantId: store.tenantId, id: { in: ids } }, select: { id: true, name: true } });
    const counts = new Map(groups.map((g) => [g.categoryId, g._count]));
    return cats
      .map((c) => ({ slug: toSlug(c.name), name: c.name, products: counts.get(c.id) ?? 0 }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  private async categoryId(store: PublicStoreContext, slug: string | undefined): Promise<string | null | undefined> {
    if (!slug) return undefined;
    const cats = await this.prisma.category.findMany({ where: { tenantId: store.tenantId }, select: { id: true, name: true } });
    return cats.find((c) => toSlug(c.name) === slug)?.id ?? null;
  }

  async list(slug: string, q: PublicProductsQueryDto) {
    const store = await this.access.resolvePublic(slug);
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 24;
    const where = publicProductWhere(store, q, await this.categoryId(store, q.category));
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: publicProductOrder(q.sort),
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          slug: true,
          name: true,
          salePrice: true,
          color: true,
          totalStock: true,
          category: { select: { name: true } },
          variants: { select: { size: true, stock: true } },
          images: { where: { isPrimary: true }, take: 1 },
        },
      }),
      this.prisma.product.count({ where }),
    ]);
    const items = await Promise.all(
      rows.map(async (p) => ({
        slug: p.slug,
        name: p.name,
        price: p.salePrice.toFixed(2),
        category: p.category?.name ?? null,
        color: p.color,
        sizes: sizesOf(p.variants),
        available: p.totalStock > 0,
        image: p.images[0] ? await this.thumb(p.images[0]) : null,
      })),
    );
    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async detail(slug: string, productSlug: string) {
    const store = await this.access.resolvePublic(slug);
    const p = await this.prisma.product.findFirst({
      where: { tenantId: store.tenantId, slug: productSlug, status: 'ACTIVE', catalogPublished: true, ...(store.hideOutOfStock ? { totalStock: { gt: 0 } } : {}) },
      select: {
        slug: true,
        name: true,
        description: true,
        salePrice: true,
        color: true,
        totalStock: true,
        category: { select: { name: true } },
        variants: { orderBy: { createdAt: 'asc' }, select: { sku: true, size: true, color: true, stock: true } },
        images: { orderBy: { position: 'asc' } },
      },
    });
    if (!p) throw new AppError(HttpStatus.NOT_FOUND, 'CATALOG_PRODUCT_NOT_FOUND', 'Esta prenda no está disponible.');
    const images = await Promise.all(p.images.map((img) => this.images.toView(img)));
    return {
      slug: p.slug,
      name: p.name,
      description: p.description,
      price: p.salePrice.toFixed(2),
      category: p.category?.name ?? null,
      color: p.color,
      available: p.totalStock > 0,
      images: images.map((i) => ({ url: i.url, thumbUrl: i.thumbUrl, width: i.width, height: i.height })),
      variants: p.variants.map((v) => ({ sku: v.sku, size: v.size, color: v.color, available: Math.min(v.stock, PUBLIC_STOCK_CAP) })),
    };
  }

  private async thumb(img: Parameters<ImagesService['toView']>[0]) {
    const view = await this.images.toView(img);
    return { url: view.thumbUrl, width: view.width, height: view.height };
  }
}
