import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AdminAppModule } from './../src/admin/admin-app.module.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { generateToken, sha256 } from './../src/common/crypto.js';
import type { PrismaService } from './../src/prisma/prisma.service.js';
import { ownerPrisma, testModule } from './support/db.js';

const run = Date.now().toString(36);
const PASSWORD = 'Moda2026segura';
const STAFF_PASSWORD = 'Equipo2026segura';
let ip = 0;

async function boot(module: typeof AppModule | typeof AdminAppModule, role: 'modaflow_app' | 'modaflow_admin') {
  const app = (await testModule(module, role).compile()).createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return app;
}

describe('AI and account consumption in the admin panel (e2e)', () => {
  let shopApp: NestExpressApplication;
  let adminApp: NestExpressApplication;
  let prisma: PrismaService;

  const agent = (app: NestExpressApplication) => {
    const forwarded = `198.66.0.${++ip}`;
    const a = request.agent(app.getHttpServer());
    return {
      get: (url: string) => a.get(url).set('X-Forwarded-For', forwarded),
      post: (url: string) => a.post(url).set('X-Forwarded-For', forwarded),
      delete: (url: string) => a.delete(url).set('X-Forwarded-For', forwarded),
    };
  };

  beforeAll(async () => {
    shopApp = await boot(AppModule, 'modaflow_app');
    adminApp = await boot(AdminAppModule, 'modaflow_admin');
    prisma = ownerPrisma();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await shopApp.close();
    await adminApp.close();
  });

  it('reports tokens, estimated cost and products per account, including deleted products', async () => {
    const shop = agent(shopApp);
    const email = `consumo.${run}@e2e.test`;
    await shop.post('/auth/register').send({ name: 'Consumo Rojas', email, password: PASSWORD }).expect(201);
    const tenantId = (await shop.post('/onboarding').send({ name: `Tienda consumo ${run}`, whatsapp: `6${Math.floor(1_000_000 + Math.random() * 8_999_999)}`, city: 'Sucre', primaryColor: '#6C4CF5' }).expect(201)).body.tenantId as string;
    const userId = (await prisma.user.findUniqueOrThrow({ where: { email } })).id;
    const product = (await shop.post('/products').send({ name: 'Blusa', salePrice: '50', variants: [{ size: 'M', quantity: 1 }] }).expect(201)).body;
    await shop.post('/products').send({ name: 'Falda', salePrice: '60', variants: [{ size: 'S', quantity: 1 }] }).expect(201);
    await shop.delete(`/products/${product.id}`).expect(204);
    const usagePeriodStart = new Date();
    await prisma.aiAnalysis.createMany({
      data: [
        { tenantId, userId, idempotencyKey: `a-${run}`, status: 'SUCCEEDED', model: 'claude-opus-5-5', creditsCharged: 1, usagePeriodStart, inputTokens: 5_000, outputTokens: 400 },
        { tenantId, userId, idempotencyKey: `b-${run}`, status: 'SUCCEEDED', model: 'claude-haiku-5-5', creditsCharged: 1, usagePeriodStart, inputTokens: 1_000_000, outputTokens: 1_000_000 },
        { tenantId, userId, idempotencyKey: `c-${run}`, status: 'FAILED', model: 'claude-opus-5-5', usagePeriodStart, errorCode: 'AI_UNAVAILABLE' },
      ],
    });

    const member = await prisma.staff.create({ data: { email: `soporte.${run}@equipo.test`, name: 'Soporte', role: 'SUPPORT' } });
    const token = generateToken();
    await prisma.staffSetupToken.create({ data: { staffId: member.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 86_400_000) } });
    const admin = agent(adminApp);
    await admin.post('/auth/setup-password').send({ token, password: STAFF_PASSWORD }).expect(204);
    await admin.post('/auth/login').send({ email: `soporte.${run}@equipo.test`, password: STAFF_PASSWORD }).expect(200);

    const usage = (await admin.get(`/admin/consumption/tenants/${tenantId}`).expect(200)).body;
    expect(usage).toMatchObject({
      ai: { analyses: 2, failed: 1, inputTokens: 1_005_000, outputTokens: 1_000_400, costUsd: 0.628 },
      products: { created: 2, deleted: 1, active: 1 },
    });

    const accounts = (await admin.get('/admin/consumption/accounts?period=today&pageSize=100').expect(200)).body;
    expect(accounts.items.find((r: { tenantId: string }) => r.tenantId === tenantId)).toMatchObject({ ai: { costUsd: 0.628 }, products: { created: 2, deleted: 1 } });

    const summary = (await admin.get('/admin/consumption?period=today').expect(200)).body;
    expect(summary.byModel.map((m: { model: string }) => m.model)).toEqual(expect.arrayContaining(['claude-opus-5-5', 'claude-haiku-5-5']));
    expect(summary.prices['claude-opus-5-5']).toEqual({ input: 4, output: 20 });

    const log = (await admin.get(`/admin/consumption/ai-log?period=today&tenantId=${tenantId}`).expect(200)).body;
    expect(log.total).toBe(3);
    expect(log.items[0]).toMatchObject({ tenant: { name: `Tienda consumo ${run}` }, user: { name: 'Consumo Rojas' } });
    expect(log.items.find((i: { status: string }) => i.status === 'FAILED')).toMatchObject({ errorCode: 'AI_UNAVAILABLE', costUsd: 0 });
    expect((await admin.get('/admin/consumption/ai-log?period=today&status=FAILED').expect(200)).body.items.every((i: { status: string }) => i.status === 'FAILED')).toBe(true);

    await agent(adminApp).get('/admin/consumption').expect(401);
  });
});
