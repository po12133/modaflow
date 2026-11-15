import { randomInt } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import { generateToken, sha256 } from '../common/crypto.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { fromCents, toCents } from '../sales/sale-math.js';
import type { CreateOrderRequestDto } from './dto/public.dto.js';
import { StorefrontAccessService } from './storefront-access.service.js';
import { orderMessage, whatsappUrl } from './storefront-rules.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');

interface Issue {
  index: number;
  code: 'NOT_FOUND' | 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK';
  available: number;
}

@Injectable()
export class PublicOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: StorefrontAccessService,
  ) {}

  async create(slug: string, dto: CreateOrderRequestDto) {
    const store = await this.access.resolvePublic(slug);
    const variants = await this.prisma.productVariant.findMany({
      where: {
        tenantId: store.tenantId,
        sku: { in: dto.items.map((i) => i.sku) },
        product: { status: 'ACTIVE', catalogPublished: true, slug: { in: dto.items.map((i) => i.productSlug) } },
      },
      select: { id: true, sku: true, size: true, color: true, stock: true, product: { select: { id: true, slug: true, name: true, salePrice: true } } },
    });
    const bySku = new Map(variants.map((v) => [v.sku, v]));
    const issues: Issue[] = [];
    const lines = dto.items.map((item, index) => {
      const v = bySku.get(item.sku);
      if (!v || v.product.slug !== item.productSlug) issues.push({ index, code: 'NOT_FOUND', available: 0 });
      else if (v.stock < item.quantity) issues.push({ index, code: v.stock === 0 ? 'OUT_OF_STOCK' : 'INSUFFICIENT_STOCK', available: v.stock });
      return { item, v };
    });
    if (issues.length > 0) {
      throw new AppError(HttpStatus.CONFLICT, 'CATALOG_ITEMS_UNAVAILABLE', 'Algunas prendas ya no están disponibles en esa cantidad.', { issues });
    }

    const priced = lines.map(({ item, v }, position) => {
      const unit = toCents(v!.product.salePrice.toFixed(2));
      return { item, v: v!, position, unit, line: unit * item.quantity };
    });
    const totalCents = priced.reduce((s, l) => s + l.line, 0);
    const token = generateToken(24);
    const request = await this.createWithCode(store.tenantId, store.storeId, token, priced, totalCents);
    const messageLines = priced.map((l) => ({ name: l.v.product.name, size: l.v.size, color: l.v.color, quantity: l.item.quantity, lineTotal: fromCents(l.line) }));
    const message = orderMessage(store.name, store.welcomeMessage, messageLines, fromCents(totalCents), request.code);
    return {
      code: request.code,
      token,
      total: fromCents(totalCents),
      items: messageLines,
      message,
      whatsappUrl: whatsappUrl(store.whatsapp, message),
    };
  }

  private async createWithCode(tenantId: string, storeId: string, token: string, priced: { item: { quantity: number }; v: { id: string; sku: string; size: string | null; color: string | null; product: { id: string; name: string } }; position: number; unit: number; line: number }[], totalCents: number) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.catalogOrderRequest.create({
          data: {
            tenantId,
            storeId,
            code: newCode(),
            tokenHash: sha256(token),
            itemCount: priced.length,
            unitCount: priced.reduce((s, l) => s + l.item.quantity, 0),
            total: fromCents(totalCents),
            items: {
              create: priced.map((l) => ({
                tenantId,
                productId: l.v.product.id,
                variantId: l.v.id,
                position: l.position,
                productName: l.v.product.name,
                sku: l.v.sku,
                size: l.v.size,
                color: l.v.color,
                quantity: l.item.quantity,
                unitPrice: fromCents(l.unit),
                lineTotal: fromCents(l.line),
              })),
            },
          },
          select: { code: true },
        });
      } catch (error) {
        const duplicate = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        if (!duplicate || attempt >= 4) throw error;
      }
    }
  }

  async markOpened(slug: string, code: string, token: string) {
    const store = await this.access.resolvePublic(slug);
    const request = await this.prisma.catalogOrderRequest.findUnique({ where: { tenantId_code: { tenantId: store.tenantId, code } } });
    if (!request || request.tokenHash !== sha256(token)) {
      throw new AppError(HttpStatus.NOT_FOUND, 'CATALOG_REQUEST_NOT_FOUND', 'No se encontró la consulta.');
    }
    if (request.status === 'CREATED') {
      await this.prisma.catalogOrderRequest.updateMany({
        where: { id: request.id, status: 'CREATED' },
        data: { status: 'WHATSAPP_OPENED', whatsappOpenedAt: new Date(), statusChangedAt: new Date() },
      });
    }
    return { code, status: request.status === 'CREATED' ? 'WHATSAPP_OPENED' : request.status };
  }
}
