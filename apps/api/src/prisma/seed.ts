/**
 * Prisma seed: loads the plan catalog into the `plans` table (idempotent
 * upsert by `code`). Plans no longer in the catalog are deactivated, never
 * deleted, so existing subscriptions keep their references.
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
    for (const plan of PLAN_CATALOG) {
      const data = { ...plan, isActive: true };
      await prisma.plan.upsert({ where: { code: plan.code }, create: data, update: data });
    }
    const { count } = await prisma.plan.updateMany({
      where: { code: { notIn: PLAN_CATALOG.map((p) => p.code) }, isActive: true },
      data: { isActive: false },
    });
    console.log(`[seed] ${PLAN_CATALOG.length} plans upserted${count ? `, ${count} deactivated` : ''}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('[seed] failed:', error);
  process.exit(1);
});
