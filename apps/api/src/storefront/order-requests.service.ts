import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListRequestsQueryDto, UpdateRequestDto } from './dto/requests.dto.js';

@Injectable()
export class OrderRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, q: ListRequestsQueryDto) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const where = { tenantId, ...(q.status ? { status: q.status } : {}) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.catalogOrderRequest.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          code: true,
          status: true,
          itemCount: true,
          unitCount: true,
          total: true,
          createdAt: true,
          items: { orderBy: { position: 'asc' }, take: 3, select: { productName: true, quantity: true } },
        },
      }),
      this.prisma.catalogOrderRequest.count({ where }),
    ]);
    return {
      items: rows.map((r) => ({ ...r, total: r.total.toFixed(2), preview: r.items.map((i) => `${i.quantity} × ${i.productName}`), items: undefined })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async get(tenantId: string, id: string) {
    const r = await this.prisma.catalogOrderRequest.findFirst({
      where: { id, tenantId },
      include: { items: { orderBy: { position: 'asc' }, include: { product: { select: { id: true, slug: true, status: true } } } } },
    });
    if (!r) throw new AppError(HttpStatus.NOT_FOUND, 'CATALOG_REQUEST_NOT_FOUND', 'No se encontró la solicitud.');
    return {
      id: r.id,
      code: r.code,
      status: r.status,
      total: r.total.toFixed(2),
      itemCount: r.itemCount,
      unitCount: r.unitCount,
      createdAt: r.createdAt,
      whatsappOpenedAt: r.whatsappOpenedAt,
      statusChangedAt: r.statusChangedAt,
      saleId: r.saleId,
      items: r.items.map((i) => ({
        productId: i.productId,
        productStatus: i.product.status,
        productName: i.productName,
        sku: i.sku,
        size: i.size,
        color: i.color,
        quantity: i.quantity,
        unitPrice: i.unitPrice.toFixed(2),
        lineTotal: i.lineTotal.toFixed(2),
      })),
    };
  }

  async update(tenantId: string, id: string, dto: UpdateRequestDto) {
    const result = await this.prisma.catalogOrderRequest.updateMany({
      where: { id, tenantId },
      data: { status: dto.status, statusChangedAt: new Date() },
    });
    if (result.count === 0) throw new AppError(HttpStatus.NOT_FOUND, 'CATALOG_REQUEST_NOT_FOUND', 'No se encontró la solicitud.');
    return this.get(tenantId, id);
  }
}
