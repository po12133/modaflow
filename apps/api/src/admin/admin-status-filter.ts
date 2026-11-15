import type { Prisma } from '../generated/prisma/client.js';
import type { SubscriptionStatus } from '../generated/prisma/enums.js';

export function effectiveStatusWhere(status: SubscriptionStatus, now: Date): Prisma.SubscriptionWhereInput {
  if (status === 'EXPIRED') return { OR: [{ status: 'EXPIRED' }, { status: { in: ['TRIALING', 'ACTIVE'] }, currentPeriodEnd: { lte: now } }] };
  if (status === 'TRIALING' || status === 'ACTIVE') return { status, currentPeriodEnd: { gt: now } };
  return { status };
}

export const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
