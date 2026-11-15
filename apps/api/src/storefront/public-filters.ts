import type { Prisma } from '../generated/prisma/client.js';
import type { PublicProductsQueryDto, PublicSort } from './dto/public.dto.js';
import type { PublicStoreContext } from './storefront-access.service.js';

const ci = (value: string) => ({ contains: value, mode: 'insensitive' as const });

export function publicProductWhere(store: PublicStoreContext, q: PublicProductsQueryDto, categoryId: string | null | undefined): Prisma.ProductWhereInput {
  const search = q.search?.trim();
  const size = q.size?.trim();
  const color = q.color?.trim();
  const onlyAvailable = store.hideOutOfStock || q.availability === 'available';
  return {
    tenantId: store.tenantId,
    status: 'ACTIVE',
    catalogPublished: true,
    ...(onlyAvailable ? { totalStock: { gt: 0 } } : {}),
    ...(categoryId !== undefined ? { categoryId: categoryId ?? '00000000-0000-0000-0000-000000000000' } : {}),
    ...(q.minPrice || q.maxPrice ? { salePrice: { ...(q.minPrice ? { gte: q.minPrice } : {}), ...(q.maxPrice ? { lte: q.maxPrice } : {}) } } : {}),
    AND: [
      ...(search
        ? [
            {
              OR: [
                { name: ci(search) },
                { color: ci(search) },
                { garmentType: ci(search) },
                { category: { name: ci(search) } },
                { tags: { some: { tag: { name: ci(search) } } } },
                { variants: { some: { OR: [{ size: ci(search) }, { color: ci(search) }] } } },
              ],
            },
          ]
        : []),
      ...(size ? [{ variants: { some: { size: { equals: size, mode: 'insensitive' as const }, stock: { gt: 0 } } } }] : []),
      ...(color ? [{ OR: [{ color: ci(color) }, { variants: { some: { color: ci(color) } } }] }] : []),
    ],
  };
}

export function publicProductOrder(sort: PublicSort | undefined): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case 'price_asc':
      return [{ salePrice: 'asc' }, { id: 'asc' }];
    case 'price_desc':
      return [{ salePrice: 'desc' }, { id: 'asc' }];
    case 'name':
      return [{ name: 'asc' }, { id: 'asc' }];
    default:
      return [{ createdAt: 'desc' }, { id: 'desc' }];
  }
}
