import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import { cleanText, displayName, normalizeKey, uniqueTags } from '../common/text.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const DEFAULT_CATEGORIES = [
  'Blusas',
  'Camisas',
  'Pantalones',
  'Vestidos',
  'Faldas',
  'Chaquetas',
  'Poleras',
  'Shorts',
  'Accesorios',
  'Otros',
] as const;

type Tx = Prisma.TransactionClient;

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates the starter categories the first time a tenant uses the catalog. */
  async ensureDefaults(tenantId: string, tx: Tx | PrismaService = this.prisma): Promise<void> {
    const count = await tx.category.count({ where: { tenantId } });
    if (count > 0) return;
    await tx.category.createMany({
      data: DEFAULT_CATEGORIES.map((name, i) => ({
        tenantId,
        name,
        normalizedName: normalizeKey(name),
        sortOrder: name === 'Otros' ? 999 : i,
      })),
      skipDuplicates: true,
    });
  }

  async list(tenantId: string) {
    await this.ensureDefaults(tenantId);
    const rows = await this.prisma.category.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        sortOrder: true,
        _count: { select: { products: { where: { status: 'ACTIVE' } } } },
      },
    });
    return rows.map((r) => ({ id: r.id, name: r.name, sortOrder: r.sortOrder, productCount: r._count.products }));
  }

  async create(tenantId: string, rawName: string) {
    const name = displayName(rawName);
    try {
      const row = await this.prisma.category.create({
        data: { tenantId, name, normalizedName: normalizeKey(name) },
        select: { id: true, name: true, sortOrder: true },
      });
      return { ...row, productCount: 0 };
    } catch (error) {
      throw this.mapConflict(error, name);
    }
  }

  async rename(tenantId: string, id: string, rawName: string) {
    const name = displayName(rawName);
    try {
      const result = await this.prisma.category.updateMany({
        where: { id, tenantId },
        data: { name, normalizedName: normalizeKey(name) },
      });
      if (result.count === 0) {
        throw new AppError(HttpStatus.NOT_FOUND, 'CATEGORY_NOT_FOUND', 'No se encontró la categoría.');
      }
    } catch (error) {
      throw this.mapConflict(error, name);
    }
    const row = await this.prisma.category.findUniqueOrThrow({
      where: { id },
      select: { id: true, name: true, sortOrder: true, _count: { select: { products: { where: { status: 'ACTIVE' } } } } },
    });
    return { id: row.id, name: row.name, sortOrder: row.sortOrder, productCount: row._count.products };
  }

  /**
   * Resolves the category for a product: an id that must belong to the
   * tenant, or a name (e.g. suggested by the AI) matched case/accent-
   * insensitively and created if it does not exist yet.
   */
  async resolve(tx: Tx, tenantId: string, input: { categoryId?: string | null; categoryName?: string | null }) {
    if (input.categoryId) {
      const found = await tx.category.findFirst({ where: { id: input.categoryId, tenantId }, select: { id: true } });
      if (!found) throw new AppError(HttpStatus.NOT_FOUND, 'CATEGORY_NOT_FOUND', 'No se encontró la categoría.');
      return found.id;
    }
    const name = input.categoryName ? cleanText(input.categoryName) : '';
    if (!name) return null;
    const normalizedName = normalizeKey(name);
    const row = await tx.category.upsert({
      where: { tenantId_normalizedName: { tenantId, normalizedName } },
      create: { tenantId, name: displayName(name), normalizedName },
      update: {},
      select: { id: true },
    });
    return row.id;
  }

  /** Upserts tags by normalized name and returns their ids (input order, no duplicates). */
  async resolveTags(tx: Tx, tenantId: string, names: string[]): Promise<string[]> {
    const tags = uniqueTags(names);
    if (tags.length === 0) return [];
    await tx.tag.createMany({
      data: tags.map((name) => ({ tenantId, name, normalizedName: normalizeKey(name) })),
      skipDuplicates: true,
    });
    const rows = await tx.tag.findMany({
      where: { tenantId, normalizedName: { in: tags.map(normalizeKey) } },
      select: { id: true, normalizedName: true },
    });
    const byKey = new Map(rows.map((r) => [r.normalizedName, r.id]));
    return tags.map((t) => byKey.get(normalizeKey(t))).filter((id): id is string => Boolean(id));
  }

  async searchTags(tenantId: string, search: string | undefined) {
    const key = search ? normalizeKey(search) : '';
    return this.prisma.tag.findMany({
      where: { tenantId, ...(key ? { normalizedName: { contains: key } } : {}) },
      orderBy: { name: 'asc' },
      take: 20,
      select: { id: true, name: true },
    });
  }

  private mapConflict(error: unknown, name: string) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new AppError(HttpStatus.CONFLICT, 'CATEGORY_EXISTS', `Ya existe la categoría "${name}".`);
    }
    return error;
  }
}
