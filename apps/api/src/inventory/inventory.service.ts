import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import { Prisma } from '../generated/prisma/client.js';
import type { InventoryMovementType } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProductsService } from '../products/products.service.js';
import { stockStatus } from '../products/product-rules.js';
import { EntitlementsService } from '../subscriptions/entitlements.service.js';
import type { InventoryQueryDto, MovementsQueryDto } from './dto.js';

const INCREASES: ReadonlySet<InventoryMovementType> = new Set(['INITIAL', 'STOCK_IN', 'ADJUSTMENT_IN']);

export interface MovementInput {
  variantId: string;
  type: Exclude<InventoryMovementType, 'INITIAL'>;
  quantity: number;
  reason?: string | null;
  reference?: string | null;
  idempotencyKey: string;
}

const MOVEMENT_INCLUDE = {
  product: { select: { id: true, name: true, sku: true } },
  variant: { select: { id: true, sku: true, size: true, color: true } },
  user: { select: { name: true } },
} satisfies Prisma.InventoryMovementInclude;

type MovementRow = Prisma.InventoryMovementGetPayload<{ include: typeof MOVEMENT_INCLUDE }>;

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly products: ProductsService,
  ) {}

  /**
   * Records a stock movement. The variant and its product are locked
   * (SELECT ... FOR UPDATE) so concurrent movements are serialized and stock
   * can never go below zero; variant stock, product total and the ledger row
   * change in the same transaction. Retrying with the same idempotency key
   * returns the original movement instead of applying it twice.
   */
  async move(tenantId: string, userId: string, input: MovementInput) {
    await this.entitlements.assertOperational(tenantId);
    try {
      const id = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.inventoryMovement.findUnique({
          where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: input.idempotencyKey } },
          select: { id: true },
        });
        if (existing) return existing.id;

        const rows = await tx.$queryRaw<{ id: string; product_id: string; stock: number; status: string }[]>`
          SELECT v.id, v.product_id, v.stock, p.status
          FROM product_variants v JOIN products p ON p.id = v.product_id
          WHERE v.id = ${input.variantId}::uuid AND v.tenant_id = ${tenantId}::uuid
          FOR UPDATE OF v, p`;
        const variant = rows[0];
        if (!variant) {
          throw new AppError(HttpStatus.NOT_FOUND, 'VARIANT_NOT_FOUND', 'No se encontró la prenda o talla.');
        }
        if (variant.status !== 'ACTIVE') {
          throw new AppError(HttpStatus.CONFLICT, 'PRODUCT_ARCHIVED', 'El producto está archivado. Restáuralo para mover su stock.');
        }

        const delta = INCREASES.has(input.type) ? input.quantity : -input.quantity;
        const stockAfter = variant.stock + delta;
        if (stockAfter < 0) {
          throw new AppError(
            HttpStatus.CONFLICT,
            'INSUFFICIENT_STOCK',
            `Solo hay ${variant.stock} ${variant.stock === 1 ? 'unidad' : 'unidades'} disponibles.`,
            { available: variant.stock },
          );
        }

        await tx.productVariant.update({ where: { id: variant.id }, data: { stock: stockAfter } });
        await tx.product.update({ where: { id: variant.product_id }, data: { totalStock: { increment: delta } } });
        const movement = await tx.inventoryMovement.create({
          data: {
            tenantId,
            productId: variant.product_id,
            variantId: variant.id,
            userId,
            type: input.type,
            quantity: input.quantity,
            stockBefore: variant.stock,
            stockAfter,
            reason: input.reason ?? null,
            reference: input.reference ?? null,
            idempotencyKey: input.idempotencyKey,
          },
          select: { id: true },
        });
        return movement.id;
      });
      return this.getMovement(tenantId, id);
    } catch (error) {
      // Two simultaneous retries with the same key: the loser returns the winner's movement.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.inventoryMovement.findUnique({
          where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: input.idempotencyKey } },
          select: { id: true },
        });
        if (existing) return this.getMovement(tenantId, existing.id);
      }
      throw error;
    }
  }

  /** Stock per product (with its variants) plus store-wide counters. */
  async stock(tenantId: string, q: InventoryQueryDto) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const where = this.products.buildWhere(tenantId, {
      search: q.search,
      categoryId: q.categoryId,
      availability: q.availability,
      status: 'active',
    });
    const active = { tenantId, status: 'ACTIVE' as const };
    const [total, rows, units, outOfStock, lowStock, productCount] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: [{ totalStock: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          sku: true,
          name: true,
          totalStock: true,
          lowStockThreshold: true,
          category: { select: { name: true } },
          variants: { select: { id: true, sku: true, size: true, color: true, stock: true }, orderBy: { createdAt: 'asc' } },
        },
      }),
      this.prisma.product.aggregate({ where: active, _sum: { totalStock: true } }),
      this.prisma.product.count({ where: { ...active, totalStock: 0 } }),
      this.prisma.product.count({
        where: { ...active, lowStockThreshold: { gt: 0 }, totalStock: { gt: 0, lte: this.prisma.product.fields.lowStockThreshold } },
      }),
      this.prisma.product.count({ where: active }),
    ]);
    return {
      summary: { products: productCount, units: units._sum.totalStock ?? 0, lowStock, outOfStock },
      items: rows.map((r) => ({
        id: r.id,
        sku: r.sku,
        name: r.name,
        category: r.category?.name ?? null,
        totalStock: r.totalStock,
        lowStockThreshold: r.lowStockThreshold,
        stockStatus: stockStatus(r.totalStock, r.lowStockThreshold),
        variants: r.variants,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async movements(tenantId: string, q: MovementsQueryDto) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 30;
    const where: Prisma.InventoryMovementWhereInput = {
      tenantId,
      ...(q.productId ? { productId: q.productId } : {}),
      ...(q.variantId ? { variantId: q.variantId } : {}),
      ...(q.type ? { type: q.type } : {}),
      ...(q.from || q.to
        ? { createdAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: endOfDay(q.to) } : {}) } }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.count({ where }),
      this.prisma.inventoryMovement.findMany({
        where,
        include: MOVEMENT_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items: rows.map(toMovementView), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  private async getMovement(tenantId: string, id: string) {
    const row = await this.prisma.inventoryMovement.findFirstOrThrow({ where: { id, tenantId }, include: MOVEMENT_INCLUDE });
    return toMovementView(row);
  }
}

function endOfDay(date: string): Date {
  const d = new Date(date);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(d.getTime() + 24 * 60 * 60 * 1000 - 1) : d;
}

function toMovementView(m: MovementRow) {
  return {
    id: m.id,
    type: m.type,
    quantity: m.quantity,
    stockBefore: m.stockBefore,
    stockAfter: m.stockAfter,
    reason: m.reason,
    reference: m.reference,
    product: m.product,
    variant: m.variant,
    user: m.user.name,
    createdAt: m.createdAt,
  };
}
