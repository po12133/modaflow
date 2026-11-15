import { randomBytes } from 'node:crypto';
import type { Prisma } from '../generated/prisma/client.js';
import { productSlug } from '../storefront/storefront-rules.js';

export async function uniqueProductSlug(tx: Prisma.TransactionClient, tenantId: string, name: string, sku: string): Promise<string> {
  const base = productSlug(name, sku);
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${randomBytes(3).toString('hex')}`;
    const taken = await tx.product.findUnique({ where: { tenantId_slug: { tenantId, slug: candidate } }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${base}-${randomBytes(6).toString('hex')}`;
}
