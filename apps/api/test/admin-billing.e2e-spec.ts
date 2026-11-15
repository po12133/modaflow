import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import sharp from 'sharp';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

const dbName = new URL(process.env['DATABASE_URL'] ?? 'postgresql://x/none').pathname.slice(1);
if (!dbName.endsWith('_test')) throw new Error(`E2E tests must run on a *_test database (got "${dbName}").`);

Object.assign(process.env, {
  S3_ENDPOINT: process.env['S3_TEST_ENDPOINT'] ?? 'http://localhost:8333',
  S3_PUBLIC_ENDPOINT: '',
  S3_BUCKET: 'modaflow-test',
  S3_ACCESS_KEY_ID: process.env['S3_ACCESS_KEY_ID'] ?? 'modaflow-dev',
  S3_SECRET_ACCESS_KEY: process.env['S3_SECRET_ACCESS_KEY'] ?? 'modaflow-dev-secret',
  S3_FORCE_PATH_STYLE: 'true',
  S3_AUTO_CREATE_BUCKET: 'true',
});

const run = Date.now().toString(36);
let ipCounter = 0;
const PASSWORD = 'Moda2026segura';
const DAY = 86_400_000;

describe('SaaS administration and billing (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let server: App;
  let receipt: Buffer;

  const agent = () => {
    const ip = `198.22.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;
    const a = request.agent(server);
    return {
      get: (url: string) => a.get(url).set('X-Forwarded-For', ip),
      post: (url: string) => a.post(url).set('X-Forwarded-For', ip),
      patch: (url: string) => a.patch(url).set('X-Forwarded-For', ip),
    };
  };
  type Agent = ReturnType<typeof agent>;

  async function account(name: string) {
    const a = agent();
    const email = `${name}.${run}.${ipCounter}@e2e.test`;
    await a.post('/auth/register').send({ name: `${name} Rojas`, email, password: PASSWORD }).expect(201);
    return { a, email, userId: (await prisma.user.findUniqueOrThrow({ where: { email } })).id };
  }

  async function store(name: string) {
    const acc = await account(name);
    const res = await acc.a.post('/onboarding').send({ name: `Tienda ${name} ${run}`, whatsapp: `6${Math.floor(1_000_000 + Math.random() * 8_999_999)}`, city: 'Sucre', primaryColor: '#6C4CF5' }).expect(201);
    return { ...acc, tenantId: res.body.tenantId as string };
  }

  async function payment(owner: Agent, planCode = 'pro', method = 'QR') {
    const req = (await owner.post('/subscription/payment-requests').send({ planCode, method }).expect(201)).body;
    await owner.post(`/subscription/payment-requests/${req.id}/receipt`).attach('file', receipt, 'comprobante.png').expect(201);
    return (await owner.post(`/subscription/payment-requests/${req.id}/submit`).expect(200)).body as { id: string; amountExpected: string; status: string };
  }

  let admin: Awaited<ReturnType<typeof account>>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    server = app.getHttpServer();
    receipt = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#2357b8' } }).png().toBuffer();
    admin = await account('admin');
    await prisma.user.update({ where: { id: admin.userId }, data: { globalRole: 'SUPERADMIN' } });
    await admin.a.patch('/admin/settings').send({ qrEnabled: true, transferEnabled: true, accountHolder: 'ModaFlow SRL', bankName: 'Banco de Prueba', accountNumber: '100200300', paymentInstructions: 'Envía el comprobante.' }).expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  it('only global roles reach /admin; support is read-only', async () => {
    await agent().get('/admin/dashboard').expect(401);
    const owner = await store('intrusa');
    expect((await owner.a.get('/admin/dashboard').expect(403)).body.code).toBe('FORBIDDEN_GLOBAL_ROLE');
    await owner.a.post('/admin/payments/00000000-0000-4000-8000-000000000000/approve').send({ amountVerified: true }).expect(403);
    const support = await account('soporte');
    await prisma.user.update({ where: { id: support.userId }, data: { globalRole: 'SUPPORT' } });
    await support.a.get('/admin/tenants').expect(200);
    expect((await support.a.patch('/admin/settings').send({ trialDays: 20 }).expect(403)).body.code).toBe('FORBIDDEN_GLOBAL_ROLE');
    expect((await admin.a.get('/admin/dashboard').expect(200)).body.kpis).toHaveProperty('mrr');
  });

  it('payment request → receipt → concurrent approval activates exactly once', async () => {
    const shop = await store('pago');
    const info = (await shop.a.get('/subscription/payment-info').expect(200)).body;
    expect(info).toMatchObject({ methods: ['QR', 'TRANSFER'], accountHolder: 'ModaFlow SRL' });
    const req = (await shop.a.post('/subscription/payment-requests').send({ planCode: 'pro', method: 'QR' }).expect(201)).body;
    expect(req).toMatchObject({ status: 'PENDING', amountExpected: '69.00', hasReceipt: false });
    expect((await shop.a.post('/subscription/payment-requests').send({ planCode: 'basico', method: 'QR' }).expect(409)).body.code).toBe('PENDING_REQUEST_EXISTS');
    expect((await shop.a.post(`/subscription/payment-requests/${req.id}/submit`).expect(400)).body.code).toBe('RECEIPT_REQUIRED');
    expect((await admin.a.post(`/admin/payments/${req.id}/approve`).send({ amountVerified: true }).expect(409)).body.code).toBe('RECEIPT_REQUIRED');
    await shop.a.post(`/subscription/payment-requests/${req.id}/receipt`).attach('file', receipt, 'c.png').expect(201);
    await shop.a.post(`/subscription/payment-requests/${req.id}/submit`).expect(200);
    expect(await prisma.notification.count({ where: { dedupeKey: `admin:payment-submitted:${req.id}` } })).toBe(1);

    await admin.a.post(`/admin/payments/${req.id}/approve`).send({ amountVerified: false }).expect(400);
    const results = await Promise.all([1, 2, 3].map(() => admin.a.post(`/admin/payments/${req.id}/approve`).send({ amountVerified: true })));
    expect(results.map((r) => r.status).sort((x, y) => x - y)).toEqual([200, 409, 409]);
    expect(await prisma.subscriptionPeriod.count({ where: { paymentRequestId: req.id } })).toBe(1);
    const sub = (await shop.a.get('/subscription').expect(200)).body;
    expect(sub).toMatchObject({ status: 'ACTIVE', plan: { code: 'pro' } });
    const approved = await prisma.planChangeRequest.findUniqueOrThrow({ where: { id: req.id } });
    expect([approved.status, approved.amountConfirmed?.toFixed(2), approved.reviewedById]).toEqual(['APPROVED', '69.00', admin.userId]);
    expect(await prisma.adminAuditLog.count({ where: { entityId: req.id, action: 'PAYMENT_APPROVED' } })).toBe(1);
    expect((await shop.a.get('/notifications').expect(200)).body.items.map((n: { type: string }) => n.type)).toContain('PAYMENT_APPROVED');

    const period = await prisma.subscriptionPeriod.findFirstOrThrow({ where: { paymentRequestId: req.id } });
    const renewal = await payment(shop.a, 'pro');
    await admin.a.post(`/admin/payments/${renewal.id}/approve`).send({ amountVerified: true }).expect(200);
    const second = await prisma.subscriptionPeriod.findFirstOrThrow({ where: { paymentRequestId: renewal.id } });
    expect(second.kind).toBe('RENEWAL');
    expect(second.periodStart.toISOString()).toBe(period.periodEnd.toISOString());
    const s = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: shop.tenantId } });
    expect(s.currentPeriodEnd.toISOString()).toBe(second.periodEnd.toISOString());

    const other = await store('ajena');
    await other.a.get(`/subscription/payment-requests/${req.id}`).expect(404);
  });

  it('rejects with reason and cannot be approved afterwards', async () => {
    const shop = await store('rechazo');
    const req = await payment(shop.a, 'basico', 'TRANSFER');
    await admin.a.post(`/admin/payments/${req.id}/reject`).send({ reason: 'El comprobante no coincide' }).expect(200);
    expect((await admin.a.post(`/admin/payments/${req.id}/approve`).send({ amountVerified: true }).expect(409)).body.code).toBe('PAYMENT_ALREADY_REVIEWED');
    expect((await shop.a.get('/subscription').expect(200)).body.status).toBe('TRIALING');
    const rejected = (await shop.a.get(`/subscription/payment-requests/${req.id}`).expect(200)).body;
    expect(rejected).toMatchObject({ status: 'REJECTED', reviewNote: 'El comprobante no coincide' });
  });

  it('versions plan prices without touching contracted periods', async () => {
    const shop = await store('version');
    const first = await payment(shop.a, 'pro');
    await admin.a.post(`/admin/payments/${first.id}/approve`).send({ amountVerified: true }).expect(200);
    const pro = await prisma.plan.findUniqueOrThrow({ where: { code: 'pro' } });
    const changed = (await admin.a.patch(`/admin/plans/${pro.id}`).send({ priceCents: 7900, reason: 'Nuevo precio de lista' }).expect(200)).body;
    expect(changed.newVersion).toBeGreaterThan(1);
    try {
      const sub = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: shop.tenantId }, include: { planVersion: true } });
      expect(sub.planVersion?.priceCents).toBe(6900);
      expect((await shop.a.get('/subscription').expect(200)).body.plan.code).toBe('pro');
      const next = (await shop.a.post('/subscription/payment-requests').send({ planCode: 'pro', method: 'QR' }).expect(201)).body;
      expect(next.amountExpected).toBe('79.00');
      expect((await agent().get('/plans').expect(200)).body.find((p: { code: string }) => p.code === 'pro').priceCents).toBe(7900);
    } finally {
      await admin.a.patch(`/admin/plans/${pro.id}`).send({ priceCents: 6900, reason: 'Volver al precio de prueba' }).expect(200);
    }
  });

  it('suspends, blocks operations and the catalog, then reactivates', async () => {
    const shop = await store('suspendida');
    await admin.a.patch(`/admin/tenants/${shop.tenantId}/status`).send({ action: 'SUSPEND', reason: 'Revisión de cuenta' }).expect(200);
    expect((await shop.a.get('/subscription').expect(200)).body).toMatchObject({ status: 'SUSPENDED', isOperational: false });
    expect((await shop.a.post('/products').send({ name: 'Blusa', salePrice: '50', variants: [{ quantity: 1 }] }).expect(403)).body.code).toBe('SUBSCRIPTION_INACTIVE');
    const slug = (await prisma.store.findFirstOrThrow({ where: { tenantId: shop.tenantId } })).slug;
    await agent().get(`/public/stores/${slug}`).expect(404);
    expect((await shop.a.post('/subscription/payment-requests').send({ planCode: 'pro', method: 'QR' }).expect(409)).body.code).toBe('SUBSCRIPTION_SUSPENDED');
    await admin.a.patch(`/admin/tenants/${shop.tenantId}/status`).send({ action: 'SUSPEND', reason: 'Otra vez' }).expect(409);
    await admin.a.patch(`/admin/tenants/${shop.tenantId}/status`).send({ action: 'REACTIVATE', reason: 'Revisión terminada' }).expect(200);
    expect((await shop.a.get('/subscription').expect(200)).body.status).toBe('TRIALING');
    expect(await prisma.subscriptionHistory.count({ where: { tenantId: shop.tenantId, action: { in: ['SUSPENDED', 'REACTIVATED'] } } })).toBe(2);
  });

  it('expiry job persists expirations once and notifies without duplicates', async () => {
    const ending = await store('porvencer');
    const expired = await store('vencida');
    await prisma.subscription.update({ where: { tenantId: ending.tenantId }, data: { currentPeriodEnd: new Date(Date.now() + 2 * DAY) } });
    await prisma.subscription.update({ where: { tenantId: expired.tenantId }, data: { currentPeriodEnd: new Date(Date.now() - 1000) } });
    expect((await expired.a.get('/subscription').expect(200)).body.status).toBe('EXPIRED');
    await admin.a.post('/admin/jobs/subscription-expiry').expect(200);
    await admin.a.post('/admin/jobs/subscription-expiry').expect(200);
    expect((await prisma.subscription.findUniqueOrThrow({ where: { tenantId: expired.tenantId } })).status).toBe('EXPIRED');
    expect(await prisma.subscriptionHistory.count({ where: { tenantId: expired.tenantId, action: 'EXPIRED' } })).toBe(1);
    expect(await prisma.notification.count({ where: { tenantId: expired.tenantId, type: 'TRIAL_EXPIRED' } })).toBe(1);
    expect(await prisma.notification.count({ where: { tenantId: ending.tenantId, type: 'TRIAL_ENDING' } })).toBe(1);
    const ext = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: expired.tenantId } });
    await admin.a.post(`/admin/subscriptions/${ext.id}/extend-trial`).send({ days: 7, reason: 'Cliente pidió más tiempo' }).expect(200);
    expect((await expired.a.get('/subscription').expect(200)).body.status).toBe('TRIALING');
    expect(await prisma.subscriptionPeriod.count({ where: { tenantId: expired.tenantId, kind: 'EXTENSION' } })).toBe(1);
  });

  it('admin plan change records the payment; user suspension closes sessions; self and last superadmin protected', async () => {
    const shop = await store('manual');
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: shop.tenantId } });
    const res = (await admin.a.post(`/admin/subscriptions/${sub.id}/change-plan`).send({ planCode: 'basico', method: 'TRANSFER', amountVerified: true, reason: 'Pago en efectivo en oficina' }).expect(201)).body;
    expect(res.period).toMatchObject({ kind: 'ACTIVATION', amount: '30.00' });
    expect((await shop.a.get('/subscription').expect(200)).body.plan.code).toBe('basico');

    await admin.a.patch(`/admin/users/${shop.userId}/status`).send({ status: 'SUSPENDED', reason: 'Uso indebido' }).expect(200);
    await shop.a.get('/auth/me').expect(401);
    expect((await agent().post('/auth/login').send({ email: shop.email, password: PASSWORD }).expect(403)).body.code).toBe('ACCOUNT_SUSPENDED');
    expect((await admin.a.patch(`/admin/users/${admin.userId}/status`).send({ status: 'SUSPENDED', reason: 'Prueba propia' }).expect(409)).body.code).toBe('LAST_SUPERADMIN');
    const detail = (await admin.a.get(`/admin/users/${shop.userId}`).expect(200)).body;
    expect(JSON.stringify(detail)).not.toMatch(/passwordHash|password_hash/);
  });

  it('audit log is append-only and revenue only counts approved payments', async () => {
    const log = await prisma.adminAuditLog.findFirstOrThrow({ where: { actorId: admin.userId } });
    await expect(prisma.$executeRaw`UPDATE admin_audit_logs SET reason = 'x' WHERE id = ${log.id}::uuid`).rejects.toThrow(/append-only/);
    await expect(prisma.$executeRaw`DELETE FROM admin_audit_logs WHERE id = ${log.id}::uuid`).rejects.toThrow(/append-only/);

    const before = (await admin.a.get('/admin/dashboard').expect(200)).body.kpis;
    const shop = await store('pendiente');
    await payment(shop.a, 'premium');
    const after = (await admin.a.get('/admin/dashboard').expect(200)).body.kpis;
    expect(after.revenueTotal).toBe(before.revenueTotal);
    expect(after.pendingPayments.count).toBe(before.pendingPayments.count + 1);
    const [{ total }] = await prisma.$queryRaw<{ total: string }[]>`SELECT coalesce(sum(amount_confirmed), 0)::text AS total FROM plan_change_requests WHERE status = 'APPROVED'`;
    expect(Number(after.revenueTotal)).toBeCloseTo(Number(total), 2);
    const [{ mrr }] = await prisma.$queryRaw<{ mrr: string }[]>`SELECT coalesce(sum(v.price_cents), 0)::text AS mrr FROM subscriptions s JOIN plan_versions v ON v.id = s.plan_version_id JOIN plans p ON p.id = s.plan_id
      WHERE s.status = 'ACTIVE' AND s.current_period_end > now() AND NOT p.is_trial AND v.billing_period = 'MONTHLY'`;
    expect(Math.round(Number(after.mrr) * 100)).toBe(Number(mrr));
    const stats = (await admin.a.get('/admin/statistics?period=this_month').expect(200)).body;
    expect(stats.usage).toHaveProperty('salesRegistered');
    expect(JSON.stringify(stats.usage)).not.toMatch(/total|profit|amount/i);
  });
});
