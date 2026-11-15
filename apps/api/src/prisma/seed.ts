/**
 * Prisma seed: creates the initial plan catalog (with its version 1) and the
 * platform settings row when they are missing. Existing plans are never
 * updated: once created, prices and limits are managed from /admin/planes and
 * PostgreSQL is the only source of truth.
 *
 *   Development: npm run prisma:seed -w @modaflow/api      (tsx src/prisma/seed.ts)
 *   Production:  node dist/prisma/seed.js                  (runs on container start)
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { PLAN_CATALOG } from '../plans/plan-catalog.js';

async function main() {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    let created = 0;
    for (const plan of PLAN_CATALOG) {
      const exists = await prisma.plan.findUnique({ where: { code: plan.code }, select: { id: true } });
      if (exists) continue;
      const row = await prisma.plan.create({ data: { ...plan, isActive: true } });
      await prisma.planVersion.create({
        data: {
          planId: row.id,
          version: 1,
          name: row.name,
          priceCents: row.priceCents,
          billingPeriod: row.billingPeriod,
          durationDays: row.durationDays,
          maxProducts: row.maxProducts,
          aiAnalysesLimit: row.aiAnalysesLimit,
          aiAnalysesPeriod: row.aiAnalysesPeriod,
          maxUsers: row.maxUsers,
          maxBranches: row.maxBranches,
          inventoryAndSales: row.inventoryAndSales,
          advancedReports: row.advancedReports,
          onlineCatalog: row.onlineCatalog,
          advancedManagement: row.advancedManagement,
          isTrial: row.isTrial,
        },
      });
      created++;
    }
    await prisma.platformSettings.upsert({ where: { id: 1 }, create: { id: 1, notificationEmails: [] }, update: {} });
    console.log(`[seed] ${created} plans created; existing plans left untouched.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('[seed] failed:', error);
  process.exit(1);
});
