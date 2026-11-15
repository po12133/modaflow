import type { PrismaService } from '../prisma/prisma.service.js';
import { DEFAULT_TIMEZONE, isValidTimeZone } from './zoned-time.js';

export async function tenantTimezone(prisma: PrismaService, tenantId: string): Promise<string> {
  const store = await prisma.store.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' }, select: { timezone: true } });
  return store?.timezone && isValidTimeZone(store.timezone) ? store.timezone : DEFAULT_TIMEZONE;
}
