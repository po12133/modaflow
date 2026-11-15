import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import { generateToken } from '../common/crypto.js';
import { Prisma } from '../generated/prisma/client.js';
import { ImagesService } from '../images/images.service.js';
import { InventoryService, type LockedVariant } from '../inventory/inventory.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProductsService } from '../products/products.service.js';
import { EntitlementsService } from '../subscriptions/entitlements.service.js';
import type { CancelSaleDto, CartDto, CreateSaleDto, ListSalesQueryDto, PosProductsQueryDto } from './dto.js';
import { periodRange, startOfLocalDay } from './sale-dates.js';
import {
  cashChange,
  computeSale,
  formatSaleNumber,
  fromCents,
  parseSaleNumber,
  SaleRuleError,
  type SaleTotals,
  toCents,
} from './sale-math.js';

type Tx = Prisma.TransactionClient;

/** Roles allowed to cancel sales. Owners only for now; add 'ADMIN' here to delegate. */
export const SALE_CANCEL_ROLES = ['OWNER'] as const;

const SALE_DETAIL_INCLUDE = {
  items: { orderBy: { position: 'asc' } },
  seller: { select: { id: true, name: true } },
  cancellation: { include: { user: { select: { name: true } } } },
  store: { select: { name: true, city: true, whatsapp: true, address: true, logoUrl: true, primaryColor: true } },
} satisfies Prisma.SaleInclude;

type SaleWithDetail = Prisma.SaleGetPayload<{ include: typeof SALE_DETAIL_INCLUDE }>;

interface PricedLine {
  variant: Pick<LockedVariant, 'id' | 'productId' | 'productName' | 'sku' | 'size' | 'color' | 'stock' | 'salePrice' | 'productStatus'>;
  quantity: number;
  discount: CartDto['items'][number]['discount'];
}

const money = (d: { toFixed(n: number): string } | null | undefined) => (d == null ? null : d.toFixed(2));

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly inventory: InventoryService,
    private readonly products: ProductsService,
    private readonly images: ImagesService,
  ) {}

  // ---------------------------------------------------------------------------
  // Point of sale
  // ---------------------------------------------------------------------------

  /** Active products for the POS, with sellable variants and stock (in-stock first unless asked). */
  async posProducts(tenantId: string, q: PosProductsQueryDto) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 24;
    const where = this.products.buildWhere(tenantId, {
      search: q.search,
      categoryId: q.categoryId,
      color: q.color,
      size: q.size,
      availability: q.includeOutOfStock ? 'all' : 'in_stock',
      status: 'active',
    });
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          sku: true,
          salePrice: true,
          totalStock: true,
          color: true,
          category: { select: { id: true, name: true } },
          images: { where: { isPrimary: true }, take: 1 },
          variants: { select: { id: true, sku: true, size: true, color: true, stock: true }, orderBy: { createdAt: 'asc' } },
        },
      }),
    ]);
    const items = await Promise.all(
      rows.map(async (p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        salePrice: p.salePrice.toFixed(2),
        totalStock: p.totalStock,
        color: p.color,
        category: p.category,
        image: p.images[0] ? await this.images.toView(p.images[0]) : null,
        variants: p.variants,
      })),
    );
    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  /** Computes amounts with current prices and stock. Creates nothing, locks nothing. */
  async preview(tenantId: string, dto: CartDto) {
    this.assertUniqueVariants(dto);
    const variants = await this.prisma.productVariant.findMany({
      where: { tenantId, id: { in: dto.items.map((i) => i.variantId) } },
      select: {
        id: true,
        productId: true,
        sku: true,
        size: true,
        color: true,
        stock: true,
        product: { select: { name: true, salePrice: true, status: true } },
      },
    });
    const byId = new Map(variants.map((v) => [v.id, v]));
    const lines: PricedLine[] = dto.items.map((item, i) => {
      const v = byId.get(item.variantId);
      if (!v) throw this.unavailable(i);
      return {
        variant: {
          id: v.id,
          productId: v.productId,
          productName: v.product.name,
          sku: v.sku,
          size: v.size,
          color: v.color,
          stock: v.stock,
          salePrice: v.product.salePrice.toFixed(2),
          productStatus: v.product.status,
        },
        quantity: item.quantity,
        discount: item.discount,
      };
    });
    const totals = this.compute(lines, dto);
    const change = this.change(dto, totals);
    const issues = lines.flatMap((l, i) => {
      if (l.variant.productStatus !== 'ACTIVE') return [{ index: i, variantId: l.variant.id, code: 'PRODUCT_UNAVAILABLE', message: `${l.variant.productName} ya no está disponible.` }];
      if (l.variant.stock < l.quantity) {
        return [{ index: i, variantId: l.variant.id, code: 'INSUFFICIENT_STOCK', available: l.variant.stock, message: `Solo hay ${l.variant.stock} de ${l.variant.productName}.` }];
      }
      return [];
    });
    return { ...this.totalsView(lines, totals, dto), change, issues, canConfirm: issues.length === 0 };
  }

  // ---------------------------------------------------------------------------
  // Sales
  // ---------------------------------------------------------------------------

  /**
   * Confirms a sale in a single transaction: lock variants, read current
   * prices, validate discounts and stock, take the next sale number, save the
   * sale and its lines, and discount stock through SALE movements. Any error
   * rolls everything back. The idempotency key makes retries return the same sale.
   */
  async create(tenantId: string, userId: string, dto: CreateSaleDto) {
    this.assertUniqueVariants(dto);
    const existing = await this.prisma.sale.findUnique({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: dto.idempotencyKey } },
      select: { id: true },
    });
    if (existing) return this.get(tenantId, existing.id);

    await this.entitlements.assertFeature(tenantId, 'inventoryAndSales');

    let saleId: string;
    try {
      saleId = await this.prisma.$transaction(async (tx) => {
        const locked = await this.inventory.lockVariants(tx, tenantId, dto.items.map((i) => i.variantId));
        const lines: PricedLine[] = dto.items.map((item, i) => {
          const variant = locked.get(item.variantId);
          if (!variant || variant.productStatus !== 'ACTIVE') throw this.unavailable(i);
          return { variant, quantity: item.quantity, discount: item.discount };
        });
        const totals = this.compute(lines, dto);
        const cash = this.change(dto, totals);
        for (const line of lines) {
          if (line.variant.stock < line.quantity) {
            throw new AppError(
              HttpStatus.CONFLICT,
              'INSUFFICIENT_STOCK',
              `Solo hay ${line.variant.stock} ${line.variant.stock === 1 ? 'unidad' : 'unidades'} de ${line.variant.productName}${line.variant.size ? ` (${line.variant.size})` : ''}.`,
              { variantId: line.variant.id, available: line.variant.stock },
            );
          }
        }

        const number = await this.nextSaleNumber(tx, tenantId);
        const store = await tx.store.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' }, select: { id: true } });
        if (!store) throw new AppError(HttpStatus.NOT_FOUND, 'STORE_NOT_FOUND', 'No se encontró la tienda.');

        const sale = await tx.sale.create({
          data: {
            tenantId,
            storeId: store.id,
            number,
            sellerId: userId,
            subtotal: fromCents(totals.subtotalCents),
            itemsDiscount: fromCents(totals.itemsDiscountCents),
            discountType: dto.discount?.type ?? null,
            discountValue: dto.discount ? fromCents(toCents(dto.discount.value)) : null,
            discountAmount: fromCents(totals.discountCents),
            total: fromCents(totals.totalCents),
            unitCount: totals.units,
            paymentMethod: dto.paymentMethod,
            paymentConfirmed: true,
            amountReceived: cash ? fromCents(cash.receivedCents) : null,
            changeGiven: cash ? fromCents(cash.changeCents) : null,
            idempotencyKey: dto.idempotencyKey,
            items: {
              create: lines.map((line, i) => {
                const r = totals.lines[i]!;
                return {
                  tenantId,
                  productId: line.variant.productId,
                  variantId: line.variant.id,
                  position: i,
                  productName: line.variant.productName,
                  sku: line.variant.sku,
                  size: line.variant.size,
                  color: line.variant.color,
                  quantity: line.quantity,
                  unitPrice: fromCents(r.unitPriceCents),
                  discountType: line.discount?.type ?? null,
                  discountValue: line.discount ? fromCents(toCents(line.discount.value)) : null,
                  unitDiscount: fromCents(r.unitDiscountCents),
                  finalUnitPrice: fromCents(r.finalUnitPriceCents),
                  lineTotal: fromCents(r.lineTotalCents),
                };
              }),
            },
          },
          select: { id: true },
        });

        for (const line of lines) {
          await this.inventory.applyLocked(tx, tenantId, userId, locked.get(line.variant.id)!, {
            type: 'SALE',
            quantity: line.quantity,
            reason: `Venta ${formatSaleNumber(number)}`,
            saleId: sale.id,
          });
        }
        return sale.id;
      });
    } catch (error) {
      // A concurrent retry with the same key already saved the sale.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const saved = await this.prisma.sale.findUnique({
          where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: dto.idempotencyKey } },
          select: { id: true },
        });
        if (saved) return this.get(tenantId, saved.id);
      }
      throw error;
    }
    this.logger.log(`Sale ${saleId} confirmed (tenant ${tenantId})`);
    return this.get(tenantId, saleId);
  }

  async list(tenantId: string, q: ListSalesQueryDto) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const range = periodRange(q.period, new Date(), q.from, q.to);
    const number = q.number ? parseSaleNumber(q.number) : null;
    if (q.number && number === null) {
      return { items: [], total: 0, page, pageSize, totalPages: 1, summary: { count: 0, total: '0.00' } };
    }
    const where: Prisma.SaleWhereInput = {
      tenantId,
      ...(range.gte || range.lt ? { createdAt: { ...(range.gte ? { gte: range.gte } : {}), ...(range.lt ? { lt: range.lt } : {}) } } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.paymentMethod ? { paymentMethod: q.paymentMethod } : {}),
      ...(number !== null ? { number } : {}),
    };
    const [total, rows, effective] = await this.prisma.$transaction([
      this.prisma.sale.count({ where }),
      this.prisma.sale.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { number: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          number: true,
          createdAt: true,
          total: true,
          unitCount: true,
          paymentMethod: true,
          status: true,
          seller: { select: { name: true } },
          items: { select: { productName: true, size: true }, orderBy: { position: 'asc' }, take: 3 },
        },
      }),
      // Totals of the filtered period exclude canceled sales.
      this.prisma.sale.aggregate({ where: { ...where, status: 'COMPLETED' }, _sum: { total: true }, _count: true }),
    ]);
    return {
      items: rows.map((s) => ({
        id: s.id,
        number: formatSaleNumber(s.number),
        createdAt: s.createdAt,
        total: s.total.toFixed(2),
        unitCount: s.unitCount,
        paymentMethod: s.paymentMethod,
        status: s.status,
        seller: s.seller.name,
        preview: s.items.map((i) => (i.size ? `${i.productName} (${i.size})` : i.productName)),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      summary: { count: effective._count, total: (effective._sum.total ?? new Prisma.Decimal(0)).toFixed(2) },
    };
  }

  async get(tenantId: string, id: string) {
    const sale = await this.prisma.sale.findFirst({ where: { id, tenantId }, include: SALE_DETAIL_INCLUDE });
    if (!sale) throw this.notFound();
    const movements = await this.prisma.inventoryMovement.findMany({
      where: { tenantId, saleId: sale.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        type: true,
        quantity: true,
        stockBefore: true,
        stockAfter: true,
        createdAt: true,
        variant: { select: { sku: true, size: true, color: true } },
        product: { select: { id: true, name: true } },
        user: { select: { name: true } },
      },
    });
    return {
      ...this.saleView(sale),
      receiptPath: sale.receiptToken ? `/boleta/${sale.receiptToken}` : null,
      movements: movements.map((m) => ({ ...m, user: m.user.name })),
    };
  }

  /**
   * Cancels a sale (never deletes it): restores stock with SALE_CANCEL
   * movements in one transaction. The sale row is locked so two simultaneous
   * cancellations cannot both restock. Money refunds are handled separately.
   */
  async cancel(tenantId: string, userId: string, id: string, dto: CancelSaleDto) {
    await this.entitlements.assertOperational(tenantId);
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string; status: string; number: number }[]>`
        SELECT id, status, number FROM sales WHERE id = ${id}::uuid AND tenant_id = ${tenantId}::uuid FOR UPDATE`;
      const sale = rows[0];
      if (!sale) throw this.notFound();
      if (sale.status === 'CANCELED') {
        const previous = await tx.saleCancellation.findUnique({ where: { saleId: id }, select: { idempotencyKey: true } });
        // Same request repeated (double tap / retry): treat as done.
        if (dto.idempotencyKey && previous?.idempotencyKey === dto.idempotencyKey) return;
        throw new AppError(HttpStatus.CONFLICT, 'SALE_ALREADY_CANCELED', 'Esta venta ya fue anulada.');
      }

      const items = await tx.saleItem.findMany({ where: { saleId: id }, orderBy: { position: 'asc' } });
      const locked = await this.inventory.lockVariants(tx, tenantId, items.map((i) => i.variantId));
      let restocked = 0;
      for (const item of items) {
        const variant = locked.get(item.variantId);
        if (!variant) continue;
        await this.inventory.applyLocked(tx, tenantId, userId, variant, {
          type: 'SALE_CANCEL',
          quantity: item.quantity,
          reason: `Anulación de ${formatSaleNumber(sale.number)}`,
          saleId: id,
        });
        restocked += item.quantity;
      }
      await tx.sale.update({ where: { id }, data: { status: 'CANCELED', canceledAt: new Date() } });
      await tx.saleCancellation.create({
        data: {
          saleId: id,
          tenantId,
          userId,
          reason: dto.reason,
          notes: dto.notes ?? null,
          restockedUnits: restocked,
          idempotencyKey: dto.idempotencyKey ?? null,
        },
      });
    });
    return this.get(tenantId, id);
  }

  // ---------------------------------------------------------------------------
  // Receipts
  // ---------------------------------------------------------------------------

  async receipt(tenantId: string, id: string) {
    const sale = await this.prisma.sale.findFirst({ where: { id, tenantId }, include: SALE_DETAIL_INCLUDE });
    if (!sale) throw this.notFound();
    return this.receiptView(sale, false);
  }

  /** Public receipt by capability token: no internal ids, seller first name only. */
  async publicReceipt(token: string) {
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw this.receiptNotFound();
    const sale = await this.prisma.sale.findUnique({ where: { receiptToken: token }, include: SALE_DETAIL_INCLUDE });
    if (!sale) throw this.receiptNotFound();
    return this.receiptView(sale, true);
  }

  /** Creates (or returns) the random public link token for sharing the receipt. */
  async createReceiptLink(tenantId: string, id: string) {
    const sale = await this.prisma.sale.findFirst({ where: { id, tenantId }, select: { id: true, receiptToken: true } });
    if (!sale) throw this.notFound();
    if (sale.receiptToken) return { token: sale.receiptToken, path: `/boleta/${sale.receiptToken}` };
    const token = generateToken(24);
    await this.prisma.sale.updateMany({ where: { id, tenantId, receiptToken: null }, data: { receiptToken: token } });
    const saved = await this.prisma.sale.findUniqueOrThrow({ where: { id }, select: { receiptToken: true } });
    return { token: saved.receiptToken!, path: `/boleta/${saved.receiptToken}` };
  }

  async revokeReceiptLink(tenantId: string, id: string) {
    const result = await this.prisma.sale.updateMany({ where: { id, tenantId }, data: { receiptToken: null } });
    if (result.count === 0) throw this.notFound();
  }

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------

  /** Today's effective sales (Bolivia time, canceled excluded) and the latest sales. */
  async summary(tenantId: string) {
    const start = startOfLocalDay(new Date());
    const today = { tenantId, status: 'COMPLETED' as const, createdAt: { gte: start } };
    const [agg, recent] = await this.prisma.$transaction([
      this.prisma.sale.aggregate({ where: today, _count: true, _sum: { total: true, unitCount: true } }),
      this.prisma.sale.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, number: true, total: true, unitCount: true, paymentMethod: true, status: true, createdAt: true },
      }),
    ]);
    return {
      today: {
        sales: agg._count,
        total: (agg._sum.total ?? new Prisma.Decimal(0)).toFixed(2),
        units: agg._sum.unitCount ?? 0,
      },
      recent: recent.map((s) => ({ ...s, number: formatSaleNumber(s.number), total: s.total.toFixed(2) })),
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private compute(lines: PricedLine[], dto: CartDto): SaleTotals {
    try {
      return computeSale(
        lines.map((l) => ({ unitPriceCents: toCents(l.variant.salePrice), quantity: l.quantity, discount: l.discount ?? null })),
        dto.discount ?? null,
      );
    } catch (error) {
      throw this.ruleError(error);
    }
  }

  private change(dto: CartDto, totals: SaleTotals) {
    if (dto.paymentMethod !== 'CASH' || !dto.amountReceived) return null;
    try {
      return cashChange(totals.totalCents, dto.amountReceived);
    } catch (error) {
      throw this.ruleError(error);
    }
  }

  private totalsView(lines: PricedLine[], totals: SaleTotals, dto: CartDto) {
    return {
      items: lines.map((l, i) => {
        const r = totals.lines[i]!;
        return {
          variantId: l.variant.id,
          productId: l.variant.productId,
          productName: l.variant.productName,
          sku: l.variant.sku,
          size: l.variant.size,
          color: l.variant.color,
          available: l.variant.stock,
          quantity: l.quantity,
          unitPrice: fromCents(r.unitPriceCents),
          discount: l.discount ?? null,
          unitDiscount: fromCents(r.unitDiscountCents),
          finalUnitPrice: fromCents(r.finalUnitPriceCents),
          lineTotal: fromCents(r.lineTotalCents),
        };
      }),
      subtotal: fromCents(totals.subtotalCents),
      itemsDiscount: fromCents(totals.itemsDiscountCents),
      discount: dto.discount ?? null,
      discountAmount: fromCents(totals.discountCents),
      total: fromCents(totals.totalCents),
      units: totals.units,
    };
  }

  private saleView(sale: SaleWithDetail) {
    return {
      id: sale.id,
      number: formatSaleNumber(sale.number),
      status: sale.status,
      createdAt: sale.createdAt,
      seller: sale.seller,
      paymentMethod: sale.paymentMethod,
      paymentConfirmed: sale.paymentConfirmed,
      amountReceived: money(sale.amountReceived),
      changeGiven: money(sale.changeGiven),
      subtotal: sale.subtotal.toFixed(2),
      itemsDiscount: sale.itemsDiscount.toFixed(2),
      discountType: sale.discountType,
      discountValue: money(sale.discountValue),
      discountAmount: sale.discountAmount.toFixed(2),
      total: sale.total.toFixed(2),
      unitCount: sale.unitCount,
      items: sale.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        variantId: i.variantId,
        productName: i.productName,
        sku: i.sku,
        size: i.size,
        color: i.color,
        quantity: i.quantity,
        unitPrice: i.unitPrice.toFixed(2),
        discountType: i.discountType,
        discountValue: money(i.discountValue),
        unitDiscount: i.unitDiscount.toFixed(2),
        finalUnitPrice: i.finalUnitPrice.toFixed(2),
        lineTotal: i.lineTotal.toFixed(2),
      })),
      cancellation: sale.cancellation
        ? {
            reason: sale.cancellation.reason,
            notes: sale.cancellation.notes,
            restockedUnits: sale.cancellation.restockedUnits,
            user: sale.cancellation.user.name,
            createdAt: sale.cancellation.createdAt,
          }
        : null,
    };
  }

  private receiptView(sale: SaleWithDetail, isPublic: boolean) {
    const view = this.saleView(sale);
    return {
      number: view.number,
      status: view.status,
      createdAt: view.createdAt,
      canceledAt: sale.canceledAt,
      seller: isPublic ? sale.seller.name.split(' ')[0] : sale.seller.name,
      store: {
        name: sale.store.name,
        city: sale.store.city,
        whatsapp: sale.store.whatsapp,
        address: sale.store.address,
        primaryColor: sale.store.primaryColor,
      },
      items: view.items.map(({ id: _id, productId: _p, variantId: _v, ...rest }) => rest),
      subtotal: view.subtotal,
      itemsDiscount: view.itemsDiscount,
      discountType: view.discountType,
      discountValue: view.discountValue,
      discountAmount: view.discountAmount,
      total: view.total,
      unitCount: view.unitCount,
      paymentMethod: view.paymentMethod,
      amountReceived: view.amountReceived,
      changeGiven: view.changeGiven,
      notice: 'Comprobante interno de venta. No es una factura fiscal.',
    };
  }

  private async nextSaleNumber(tx: Tx, tenantId: string): Promise<number> {
    // Row-level lock on the tenant: concurrent sales get consecutive, unique numbers.
    const rows = await tx.$queryRaw<{ sale_seq: number }[]>`
      UPDATE tenants SET sale_seq = sale_seq + 1 WHERE id = ${tenantId}::uuid RETURNING sale_seq`;
    return rows[0]!.sale_seq;
  }

  private assertUniqueVariants(dto: CartDto) {
    const seen = new Set<string>();
    dto.items.forEach((item, i) => {
      if (seen.has(item.variantId)) {
        throw new AppError(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'Revisa los datos ingresados.', {
          errors: { [`items.${i}.variantId`]: ['Esta prenda ya está en la venta: cambia su cantidad.'] },
        });
      }
      seen.add(item.variantId);
    });
  }

  private ruleError(error: unknown) {
    if (error instanceof SaleRuleError) {
      return new AppError(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', error.message, { errors: { [error.field]: [error.message] } });
    }
    return error;
  }

  private unavailable(index: number) {
    return new AppError(HttpStatus.CONFLICT, 'PRODUCT_UNAVAILABLE', 'Una de las prendas ya no está disponible. Quítala de la venta.', {
      index,
    });
  }

  private notFound() {
    return new AppError(HttpStatus.NOT_FOUND, 'SALE_NOT_FOUND', 'No se encontró la venta.');
  }

  private receiptNotFound() {
    return new AppError(HttpStatus.NOT_FOUND, 'RECEIPT_NOT_FOUND', 'Este comprobante no existe o el enlace fue desactivado.');
  }
}
