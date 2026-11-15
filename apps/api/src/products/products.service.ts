import { HttpStatus, Injectable } from '@nestjs/common';
import { CategoriesService } from '../catalog/categories.service.js';
import { AppError } from '../common/app-error.js';
import { cleanText, normalizeKey } from '../common/text.js';
import { Prisma } from '../generated/prisma/client.js';
import { ImagesService } from '../images/images.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EntitlementsService } from '../subscriptions/entitlements.service.js';
import type { CreateProductDto, ListProductsQueryDto, UpdateProductDto, VariantInputDto } from './dto.js';
import { uniqueProductSlug } from './product-slug.js';
import {
  findDuplicateVariant,
  formatProductSku,
  isPositiveMoney,
  moneyToFixed,
  stockStatus,
  variantSkuSuffix,
} from './product-rules.js';

type Tx = Prisma.TransactionClient;

const DETAIL_INCLUDE = {
  category: { select: { id: true, name: true } },
  tags: { select: { tag: { select: { name: true } } }, orderBy: { tag: { name: 'asc' } } },
  variants: { orderBy: [{ createdAt: 'asc' }, { sku: 'asc' }] },
  images: { orderBy: { position: 'asc' } },
  createdBy: { select: { name: true } },
} satisfies Prisma.ProductInclude;

type ProductWithDetail = Prisma.ProductGetPayload<{ include: typeof DETAIL_INCLUDE }>;

const LIST_INCLUDE = {
  category: { select: { id: true, name: true } },
  variants: { select: { size: true, color: true, stock: true }, orderBy: { createdAt: 'asc' } },
  images: { where: { isPrimary: true }, take: 1 },
} satisfies Prisma.ProductInclude;

type ProductListRow = Prisma.ProductGetPayload<{ include: typeof LIST_INCLUDE }>;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly categories: CategoriesService,
    private readonly images: ImagesService,
  ) {}

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  /** Builds the tenant-scoped filter shared by products and inventory lists. */
  buildWhere(tenantId: string, q: ListProductsQueryDto): Prisma.ProductWhereInput {
    const and: Prisma.ProductWhereInput[] = [];
    const search = q.search ? cleanText(q.search) : '';
    if (search) {
      const key = normalizeKey(search);
      and.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { garmentType: { contains: search, mode: 'insensitive' } },
          { category: { name: { contains: search, mode: 'insensitive' } } },
          { variants: { some: { sku: { contains: search, mode: 'insensitive' } } } },
          { tags: { some: { tag: { normalizedName: { contains: key } } } } },
        ],
      });
    }
    if (q.color) {
      const color = cleanText(q.color);
      and.push({
        OR: [
          { color: { equals: color, mode: 'insensitive' } },
          { variants: { some: { color: { equals: color, mode: 'insensitive' } } } },
        ],
      });
    }
    if (q.size) {
      and.push({ variants: { some: { size: { equals: cleanText(q.size), mode: 'insensitive' } } } });
    }
    switch (q.availability) {
      case 'in_stock':
        and.push({ totalStock: { gt: 0 } });
        break;
      case 'out_of_stock':
        and.push({ totalStock: 0 });
        break;
      case 'low_stock':
        and.push({
          lowStockThreshold: { gt: 0 },
          totalStock: { gt: 0, lte: this.prisma.product.fields.lowStockThreshold },
        });
        break;
    }
    return {
      tenantId,
      status: q.status === 'archived' ? 'ARCHIVED' : 'ACTIVE',
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(and.length ? { AND: and } : {}),
    };
  }

  orderBy(sort: ListProductsQueryDto['sort']): Prisma.ProductOrderByWithRelationInput[] {
    switch (sort) {
      case 'oldest':
        return [{ createdAt: 'asc' }, { id: 'asc' }];
      case 'price_asc':
        return [{ salePrice: 'asc' }, { createdAt: 'desc' }];
      case 'price_desc':
        return [{ salePrice: 'desc' }, { createdAt: 'desc' }];
      case 'name':
        return [{ name: 'asc' }, { id: 'asc' }];
      default:
        return [{ createdAt: 'desc' }, { id: 'desc' }];
    }
  }

  async list(tenantId: string, q: ListProductsQueryDto) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const where = this.buildWhere(tenantId, q);
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: this.orderBy(q.sort),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    const items = await Promise.all(rows.map((r) => this.toListItem(r)));
    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async get(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({ where: { id, tenantId }, include: DETAIL_INCLUDE });
    if (!product) throw this.notFound();
    return this.toDetail(product);
  }

  // ---------------------------------------------------------------------------
  // Commands
  // ---------------------------------------------------------------------------

  async create(tenantId: string, userId: string, dto: CreateProductDto) {
    if (!isPositiveMoney(dto.salePrice)) throw this.invalidPrice();
    const dupIndex = findDuplicateVariant(dto.variants);
    if (dupIndex >= 0) throw this.duplicateVariant();

    // Idempotent retry: the draft id was already saved.
    if (dto.id) {
      const existing = await this.prisma.product.findUnique({ where: { id: dto.id }, select: { tenantId: true } });
      if (existing) {
        if (existing.tenantId !== tenantId) throw this.notFound();
        return this.get(tenantId, dto.id);
      }
    }

    const ent = await this.entitlements.assertOperational(tenantId);
    const maxProducts = ent.limits.products.limit;

    let productId: string;
    try {
      productId = await this.prisma.$transaction(async (tx) => {
        await this.lockAndCheckProductLimit(tx, tenantId, maxProducts, ent.plan.name);

        const store = await tx.store.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' }, select: { id: true } });
        if (!store) throw new AppError(HttpStatus.NOT_FOUND, 'STORE_NOT_FOUND', 'No se encontró la tienda.');

        await this.categories.ensureDefaults(tenantId, tx);
        const categoryId = await this.categories.resolve(tx, tenantId, dto);
        const tagIds = await this.categories.resolveTags(tx, tenantId, dto.tags ?? []);
        const sku = dto.sku ?? (await this.nextProductSku(tx, tenantId));
        const totalStock = dto.variants.reduce((sum, v) => sum + v.quantity, 0);

        const product = await tx.product.create({
          data: {
            ...(dto.id ? { id: dto.id } : {}),
            tenantId,
            storeId: store.id,
            categoryId,
            createdById: userId,
            sku,
            slug: await uniqueProductSlug(tx, tenantId, dto.name, sku),
            name: cleanText(dto.name),
            description: dto.description ?? null,
            garmentType: dto.garmentType ?? null,
            color: dto.color ?? null,
            secondaryColors: (dto.secondaryColors ?? []).map(cleanText).filter(Boolean),
            style: dto.style ?? null,
            salePrice: dto.salePrice,
            purchasePrice: dto.purchasePrice ?? null,
            lowStockThreshold: dto.lowStockThreshold ?? 2,
            totalStock,
            tags: { create: tagIds.map((tagId) => ({ tagId })) },
          },
          select: { id: true },
        });

        await this.createVariants(tx, tenantId, userId, product.id, sku, dto.variants, 0);
        await this.attachImages(tx, tenantId, product.id, dto.imageIds ?? [], dto.primaryImageId);
        if (dto.aiAnalysisId) await this.linkAnalysis(tx, tenantId, product.id, dto.aiAnalysisId);
        return product.id;
      });
    } catch (error) {
      // A concurrent retry with the same draft id already created it: return that one.
      if (dto.id && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const saved = await this.prisma.product.findFirst({ where: { id: dto.id, tenantId }, select: { id: true } });
        if (saved) return this.get(tenantId, saved.id);
      }
      throw this.mapWriteError(error);
    }
    return this.get(tenantId, productId);
  }

  async update(tenantId: string, userId: string, id: string, dto: UpdateProductDto) {
    if (dto.salePrice !== undefined && !isPositiveMoney(dto.salePrice)) throw this.invalidPrice();
    await this.entitlements.assertOperational(tenantId);

    let removedKeys: string[] = [];
    try {
      removedKeys = await this.prisma.$transaction(async (tx) => {
        const product = await this.lockProduct(tx, tenantId, id);
        if (product.status === 'ARCHIVED') {
          throw new AppError(HttpStatus.CONFLICT, 'PRODUCT_ARCHIVED', 'Restaura el producto para poder editarlo.');
        }

        const data: Prisma.ProductUpdateInput = {};
        if (dto.name !== undefined) data.name = cleanText(dto.name);
        if (dto.description !== undefined) data.description = dto.description;
        if (dto.garmentType !== undefined) data.garmentType = dto.garmentType;
        if (dto.color !== undefined) data.color = dto.color;
        if (dto.secondaryColors !== undefined) data.secondaryColors = dto.secondaryColors.map(cleanText).filter(Boolean);
        if (dto.style !== undefined) data.style = dto.style;
        if (dto.salePrice !== undefined) data.salePrice = dto.salePrice;
        if (dto.purchasePrice !== undefined) data.purchasePrice = dto.purchasePrice;
        if (dto.lowStockThreshold !== undefined) data.lowStockThreshold = dto.lowStockThreshold;
        if (dto.sku !== undefined) data.sku = dto.sku;
        if (dto.categoryId !== undefined || dto.categoryName !== undefined) {
          const categoryId = await this.categories.resolve(tx, tenantId, dto);
          data.category = categoryId ? { connect: { id: categoryId } } : { disconnect: true };
        }
        if (dto.tags !== undefined) {
          const tagIds = await this.categories.resolveTags(tx, tenantId, dto.tags);
          data.tags = { deleteMany: {}, create: tagIds.map((tagId) => ({ tagId })) };
        }
        await tx.product.update({ where: { id }, data });

        // Variants: rename/re-code existing ones (stock untouched), add new ones with initial stock.
        const existing = await tx.productVariant.findMany({ where: { productId: id }, select: { id: true, size: true, color: true } });
        if (dto.variantsUpdate?.length) {
          for (const v of dto.variantsUpdate) {
            const current = existing.find((e) => e.id === v.id);
            if (!current) throw new AppError(HttpStatus.NOT_FOUND, 'VARIANT_NOT_FOUND', 'No se encontró la variante.');
            const patch: Prisma.ProductVariantUpdateInput = {};
            if (v.size !== undefined) patch.size = v.size;
            if (v.color !== undefined) patch.color = v.color;
            if (v.sku !== undefined) patch.sku = v.sku;
            await tx.productVariant.update({ where: { id: v.id }, data: patch });
          }
        }
        if (dto.variantsAdd?.length) {
          const all = await tx.productVariant.findMany({ where: { productId: id }, select: { size: true, color: true } });
          if (findDuplicateVariant([...all, ...dto.variantsAdd]) >= 0) throw this.duplicateVariant();
          const added = await this.createVariants(tx, tenantId, userId, id, product.sku, dto.variantsAdd, existing.length);
          if (added > 0) await tx.product.update({ where: { id }, data: { totalStock: { increment: added } } });
        }
        if (dto.variantsUpdate?.length) {
          const all = await tx.productVariant.findMany({ where: { productId: id }, select: { size: true, color: true } });
          if (findDuplicateVariant(all) >= 0) throw this.duplicateVariant();
        }

        if (dto.images) {
          const current = await tx.productImage.findMany({ where: { productId: id }, select: { id: true, storageKey: true } });
          const removed = current.filter((img) => !dto.images!.imageIds.includes(img.id));
          if (removed.length) await tx.productImage.deleteMany({ where: { id: { in: removed.map((r) => r.id) } } });
          await this.attachImages(tx, tenantId, id, dto.images.imageIds, dto.images.primaryImageId);
          return removed.map((r) => r.storageKey);
        }
        return [];
      });
    } catch (error) {
      throw this.mapWriteError(error);
    }
    await this.images.removeObjects(removedKeys);
    return this.get(tenantId, id);
  }

  /** Logical delete: archived products keep their history and stop counting towards the limit. */
  async archive(tenantId: string, id: string) {
    await this.entitlements.assertOperational(tenantId);
    const result = await this.prisma.product.updateMany({
      where: { id, tenantId, status: 'ACTIVE' },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    });
    if (result.count === 0) {
      const exists = await this.prisma.product.count({ where: { id, tenantId } });
      if (!exists) throw this.notFound();
    }
  }

  async restore(tenantId: string, id: string) {
    const ent = await this.entitlements.assertOperational(tenantId);
    await this.prisma.$transaction(async (tx) => {
      const product = await this.lockProduct(tx, tenantId, id);
      if (product.status === 'ACTIVE') return;
      await this.lockAndCheckProductLimit(tx, tenantId, ent.limits.products.limit, ent.plan.name);
      await tx.product.update({ where: { id }, data: { status: 'ACTIVE', archivedAt: null } });
    });
    return this.get(tenantId, id);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Serializes product creation per tenant (row lock on its subscription) and
   * checks the plan limit. Rule: only ACTIVE products count; each product
   * counts once no matter how many variants or units it has.
   */
  private async lockAndCheckProductLimit(tx: Tx, tenantId: string, max: number, planName: string) {
    await tx.$queryRaw`SELECT id FROM subscriptions WHERE tenant_id = ${tenantId}::uuid FOR UPDATE`;
    const active = await tx.product.count({ where: { tenantId, status: 'ACTIVE' } });
    if (active >= max) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'PLAN_LIMIT_REACHED',
        `Alcanzaste el límite de ${max} productos de tu plan ${planName}. Archiva productos que ya no vendes o cambia de plan.`,
        { limit: 'products', max, used: active },
      );
    }
  }

  private async lockProduct(tx: Tx, tenantId: string, id: string) {
    const rows = await tx.$queryRaw<{ id: string; sku: string; status: 'ACTIVE' | 'ARCHIVED' }[]>`
      SELECT id, sku, status FROM products WHERE id = ${id}::uuid AND tenant_id = ${tenantId}::uuid FOR UPDATE`;
    const product = rows[0];
    if (!product) throw this.notFound();
    return product;
  }

  private async nextProductSku(tx: Tx, tenantId: string): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt++) {
      const rows = await tx.$queryRaw<{ product_seq: number }[]>`
        UPDATE tenants SET product_seq = product_seq + 1 WHERE id = ${tenantId}::uuid RETURNING product_seq`;
      const sku = formatProductSku(rows[0]!.product_seq);
      const taken = await tx.product.findUnique({ where: { tenantId_sku: { tenantId, sku } }, select: { id: true } });
      if (!taken) return sku;
    }
    throw new Error('Could not generate a free product SKU');
  }

  /** Creates variants with their initial stock and one INITIAL movement each. Returns units added. */
  private async createVariants(
    tx: Tx,
    tenantId: string,
    userId: string,
    productId: string,
    productSku: string,
    variants: VariantInputDto[],
    existingCount: number,
  ): Promise<number> {
    const single = existingCount === 0 && variants.length === 1 && !variants[0]!.size && !variants[0]!.color;
    let units = 0;
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i]!;
      const sku = v.sku ?? (await this.freeVariantSku(tx, tenantId, single ? productSku : `${productSku}-${variantSkuSuffix(v.size, v.color) || existingCount + i + 1}`));
      const variant = await tx.productVariant.create({
        data: { tenantId, productId, sku, size: v.size ?? null, color: v.color ?? null, stock: v.quantity },
        select: { id: true },
      });
      if (v.quantity > 0) {
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            productId,
            variantId: variant.id,
            userId,
            type: 'INITIAL',
            quantity: v.quantity,
            stockBefore: 0,
            stockAfter: v.quantity,
            reason: 'Registro de la prenda',
          },
        });
      }
      units += v.quantity;
    }
    return units;
  }

  private async freeVariantSku(tx: Tx, tenantId: string, base: string): Promise<string> {
    let candidate = base.slice(0, 48);
    for (let n = 2; n < 100; n++) {
      const taken = await tx.productVariant.findUnique({ where: { tenantId_sku: { tenantId, sku: candidate } }, select: { id: true } });
      if (!taken) return candidate;
      candidate = `${base.slice(0, 44)}-${n}`;
    }
    throw new Error('Could not generate a free variant SKU');
  }

  /** Links uploaded photos (stored under this product's key prefix) in the given order. */
  private async attachImages(tx: Tx, tenantId: string, productId: string, imageIds: string[], primaryImageId?: string) {
    const ids = [...new Set(imageIds)];
    if (ids.length === 0) return;
    const prefix = `tenants/${tenantId}/products/${productId}/`;
    const found = await tx.productImage.findMany({
      where: { id: { in: ids }, tenantId, storageKey: { startsWith: prefix }, OR: [{ productId: null }, { productId }] },
      select: { id: true },
    });
    if (found.length !== ids.length) {
      throw new AppError(HttpStatus.NOT_FOUND, 'IMAGE_NOT_FOUND', 'Una de las fotos ya no está disponible. Vuelve a subirla.');
    }
    const primary = primaryImageId && ids.includes(primaryImageId) ? primaryImageId : ids[0];
    await tx.productImage.updateMany({ where: { productId }, data: { isPrimary: false } });
    for (let i = 0; i < ids.length; i++) {
      await tx.productImage.update({
        where: { id: ids[i] },
        data: { productId, position: i, isPrimary: ids[i] === primary },
      });
    }
  }

  private async linkAnalysis(tx: Tx, tenantId: string, productId: string, analysisId: string) {
    const analysis = await tx.aiAnalysis.findFirst({
      where: { id: analysisId, tenantId, status: 'SUCCEEDED', product: null },
      select: { id: true },
    });
    if (analysis) await tx.product.update({ where: { id: productId }, data: { aiAnalysisId: analysis.id } });
  }

  private mapWriteError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = JSON.stringify(error.meta ?? {});
      if (target.includes('sku')) {
        return new AppError(HttpStatus.CONFLICT, 'SKU_TAKEN', 'Ese código ya está en uso en tu tienda.');
      }
      return this.duplicateVariant();
    }
    return error;
  }

  private notFound() {
    return new AppError(HttpStatus.NOT_FOUND, 'PRODUCT_NOT_FOUND', 'No se encontró el producto.');
  }

  private invalidPrice() {
    return new AppError(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'Revisa los datos ingresados.', {
      errors: { salePrice: ['El precio de venta debe ser mayor a 0.'] },
    });
  }

  private duplicateVariant() {
    return new AppError(HttpStatus.CONFLICT, 'DUPLICATE_VARIANT', 'Hay tallas/colores repetidos en la prenda.');
  }

  // ---------------------------------------------------------------------------
  // Mapping
  // ---------------------------------------------------------------------------

  private async toListItem(p: ProductListRow) {
    const primary = p.images[0];
    const sizes = [...new Set(p.variants.map((v) => v.size).filter((s): s is string => Boolean(s)))];
    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      color: p.color,
      garmentType: p.garmentType,
      category: p.category,
      salePrice: moneyToFixed(p.salePrice)!,
      totalStock: p.totalStock,
      lowStockThreshold: p.lowStockThreshold,
      stockStatus: stockStatus(p.totalStock, p.lowStockThreshold),
      status: p.status,
      sizes,
      variantCount: p.variants.length,
      image: primary ? await this.images.toView(primary) : null,
      createdAt: p.createdAt,
    };
  }

  private async toDetail(p: ProductWithDetail) {
    return {
      id: p.id,
      sku: p.sku,
      slug: p.slug,
      catalogPublished: p.catalogPublished,
      name: p.name,
      description: p.description,
      garmentType: p.garmentType,
      color: p.color,
      secondaryColors: p.secondaryColors,
      style: p.style,
      category: p.category,
      tags: p.tags.map((t) => t.tag.name),
      salePrice: moneyToFixed(p.salePrice)!,
      purchasePrice: moneyToFixed(p.purchasePrice),
      lowStockThreshold: p.lowStockThreshold,
      totalStock: p.totalStock,
      stockStatus: stockStatus(p.totalStock, p.lowStockThreshold),
      status: p.status,
      variants: p.variants.map((v) => ({ id: v.id, sku: v.sku, size: v.size, color: v.color, stock: v.stock })),
      images: await Promise.all(p.images.map((img) => this.images.toView(img))),
      aiAssisted: p.aiAnalysisId !== null,
      createdBy: p.createdBy.name,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      archivedAt: p.archivedAt,
    };
  }
}
