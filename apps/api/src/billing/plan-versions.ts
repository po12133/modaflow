import type { Plan, Prisma } from '../generated/prisma/client.js';

type Db = Prisma.TransactionClient;

export const VERSIONED_FIELDS = [
  'name',
  'priceCents',
  'billingPeriod',
  'durationDays',
  'maxProducts',
  'aiAnalysesLimit',
  'aiAnalysesPeriod',
  'maxUsers',
  'maxBranches',
  'inventoryAndSales',
  'advancedReports',
  'onlineCatalog',
  'advancedManagement',
  'isTrial',
] as const;

export function versionChanged(before: Plan, after: Plan): boolean {
  return VERSIONED_FIELDS.some((f) => before[f] !== after[f]);
}

export async function latestVersion(db: Db, planId: string) {
  return db.planVersion.findFirstOrThrow({ where: { planId }, orderBy: { version: 'desc' } });
}

export async function snapshotPlan(db: Db, plan: Plan, actorId: string | null) {
  const last = await db.planVersion.findFirst({ where: { planId: plan.id }, orderBy: { version: 'desc' }, select: { version: true } });
  const data = Object.fromEntries(VERSIONED_FIELDS.map((f) => [f, plan[f]])) as Pick<Plan, (typeof VERSIONED_FIELDS)[number]>;
  return db.planVersion.create({ data: { ...data, planId: plan.id, version: (last?.version ?? 0) + 1, createdById: actorId } });
}
