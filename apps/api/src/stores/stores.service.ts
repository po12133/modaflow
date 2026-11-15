import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { StoreDto, UpdateStoreDto } from './dto.js';

export const STORE_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  whatsapp: true,
  city: true,
  address: true,
  primaryColor: true,
  logoUrl: true,
  updatedAt: true,
} as const;

/** All queries are scoped by the tenant resolved from the user's membership. */
@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(tenantId: string): Promise<StoreDto> {
    const store = await this.prisma.store.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      select: STORE_SELECT,
    });
    if (!store) throw new AppError(HttpStatus.NOT_FOUND, 'STORE_NOT_FOUND', 'No se encontró la tienda.');
    return store;
  }

  async updateCurrent(tenantId: string, dto: UpdateStoreDto): Promise<StoreDto> {
    const current = await this.getCurrent(tenantId);
    // updateMany with tenantId in the filter: the write itself is tenant-scoped.
    const result = await this.prisma.store.updateMany({
      where: { id: current.id, tenantId },
      data: {
        name: dto.name,
        description: dto.description ?? null,
        whatsapp: dto.whatsapp,
        city: dto.city,
        address: dto.address ?? null,
        primaryColor: dto.primaryColor,
      },
    });
    if (result.count === 0) throw new AppError(HttpStatus.NOT_FOUND, 'STORE_NOT_FOUND', 'No se encontró la tienda.');
    return this.getCurrent(tenantId);
  }
}
