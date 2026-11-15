// End-to-end tests against a real PostgreSQL database.
// Requires DATABASE_URL pointing to a dedicated *_test database with migrations
// and seed applied (see README "Pruebas"). Refuses to run on any other database.
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { MailService } from './../src/mail/mail.service.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

const dbName = new URL(process.env['DATABASE_URL'] ?? 'postgresql://x/none').pathname.slice(1);
if (!dbName.endsWith('_test')) {
  throw new Error(`E2E tests must run on a *_test database (got "${dbName}").`);
}

const run = Date.now().toString(36);
let ipCounter = 0;
/** Unique client IP per agent (trusted X-Forwarded-For from loopback) so rate limits don't interfere. */
const nextIp = () => `203.0.113.${(ipCounter++ % 250) + 1}`;
const email = (name: string) => `${name}.${run}@e2e.test`;
const PASSWORD = 'Moda2026segura';

function storeBody(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Tienda E2E',
    description: 'Moda femenina',
    whatsapp: `7${Math.floor(1_000_000 + Math.random() * 8_999_999)}`,
    city: 'Cochabamba',
    address: 'Av. Heroínas 123',
    primaryColor: '#6c4cf5',
    ...overrides,
  };
}

describe('ModaFlow API (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let server: App;

  /** Cookie-keeping client with its own IP. */
  const agent = () => {
    const ip = nextIp();
    const a = request.agent(server);
    return {
      get: (url: string) => a.get(url).set('X-Forwarded-For', ip),
      post: (url: string) => a.post(url).set('X-Forwarded-For', ip),
      put: (url: string) => a.put(url).set('X-Forwarded-For', ip),
      delete: (url: string) => a.delete(url).set('X-Forwarded-For', ip),
    };
  };

  async function registerAndOnboard(name: string, store: Record<string, unknown> = {}) {
    const a = agent();
    await a.post('/auth/register').send({ name, email: email(name), password: PASSWORD }).expect(201);
    const res = await a.post('/onboarding').send(storeBody(store)).expect(201);
    return { agent: a, onboarding: res.body as { tenantId: string; trialGranted: boolean; store: { id: string } } };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health is public (Docker/Coolify healthcheck)', async () => {
    const res = await agent().get('/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', database: { status: 'up' } });
  });

  describe('plans', () => {
    it('lists the four plans from the database, Pro recommended', async () => {
      const res = await agent().get('/plans').expect(200);
      expect(res.body.map((p: { code: string }) => p.code)).toEqual(['gratis', 'basico', 'pro', 'premium']);
      expect(res.body.find((p: { isRecommended: boolean }) => p.isRecommended).code).toBe('pro');
      expect(res.body[0]).toMatchObject({ priceCents: 0, durationDays: 14, limits: { products: 30, aiAnalyses: 10 } });
    });
  });

  describe('authentication', () => {
    it('protects private routes', async () => {
      const res = await agent().get('/auth/me').expect(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
      await agent().get('/stores/current').expect(401);
      await agent().get('/subscription').expect(401);
    });

    it('registers with an HttpOnly cookie, without activating the trial yet', async () => {
      const a = agent();
      const res = await a
        .post('/auth/register')
        .send({ name: 'Ana', email: email('ana'), password: PASSWORD })
        .expect(201);
      const cookie = String(res.headers['set-cookie']);
      expect(cookie).toMatch(/mf_session=/);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(res.body).not.toHaveProperty('passwordHash');

      const me = await a.get('/auth/me').expect(200);
      expect(me.body).toMatchObject({ user: { email: email('ana') }, membership: null, needsOnboarding: true });
      expect((await a.get('/subscription').expect(403)).body.code).toBe('NO_TENANT');
      expect(await prisma.trialGrant.count({ where: { user: { email: email('ana') } } })).toBe(0);

      const stored = await prisma.user.findUniqueOrThrow({ where: { email: email('ana') } });
      expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    });

    it('rejects duplicate emails and weak passwords with field errors', async () => {
      const a = agent();
      await a.post('/auth/register').send({ name: 'Dup', email: email('dup'), password: PASSWORD }).expect(201);
      const dup = await a
        .post('/auth/register')
        .send({ name: 'Dup', email: email('DUP').toUpperCase(), password: PASSWORD })
        .expect(409);
      expect(dup.body.code).toBe('EMAIL_TAKEN');

      const weak = await agent()
        .post('/auth/register')
        .send({ name: 'W', email: 'no-es-correo', password: 'corta' })
        .expect(400);
      expect(weak.body.code).toBe('VALIDATION_ERROR');
      expect(Object.keys(weak.body.errors).sort()).toEqual(['email', 'name', 'password']);
    });

    it('logs in, logs out and revokes the session', async () => {
      const a = agent();
      await a.post('/auth/register').send({ name: 'Luz', email: email('luz'), password: PASSWORD }).expect(201);
      await a.post('/auth/logout').expect(204);
      await a.get('/auth/me').expect(401);

      const bad = await a.post('/auth/login').send({ email: email('luz'), password: 'incorrecta1' }).expect(401);
      expect(bad.body.code).toBe('INVALID_CREDENTIALS');
      await a.post('/auth/login').send({ email: email('LUZ'), password: PASSWORD }).expect(200);
      await a.get('/auth/me').expect(200);
    });

    it('locks the account after 5 failed attempts', async () => {
      const a = agent();
      await a.post('/auth/register').send({ name: 'Lock', email: email('lock'), password: PASSWORD }).expect(201);
      for (let i = 0; i < 5; i++) {
        await a.post('/auth/login').send({ email: email('lock'), password: 'incorrecta1' }).expect(401);
      }
      const locked = await a.post('/auth/login').send({ email: email('lock'), password: PASSWORD }).expect(429);
      expect(locked.body.code).toBe('ACCOUNT_LOCKED');
    });

    it('rejects state-changing requests from foreign origins (CSRF)', async () => {
      const res = await agent()
        .post('/auth/login')
        .set('Origin', 'https://otro.amicornios.com')
        .send({ email: email('ana'), password: PASSWORD })
        .expect(403);
      expect(res.body.code).toBe('INVALID_ORIGIN');
      await agent()
        .post('/auth/login')
        .set('Origin', 'http://localhost:3000')
        .send({ email: email('ana'), password: PASSWORD })
        .expect(200);
    });

    it('resets the password with a single-use token and closes all sessions', async () => {
      const a = agent();
      await a.post('/auth/register').send({ name: 'Rosa', email: email('rosa'), password: PASSWORD }).expect(201);

      const mail = app.get(MailService);
      const spy = vi.spyOn(mail, 'sendPasswordReset');
      const generic = await agent().post('/auth/password/forgot').send({ email: email('nadie') }).expect(202);
      expect(spy).not.toHaveBeenCalled();
      const res = await agent().post('/auth/password/forgot').send({ email: email('rosa') }).expect(202);
      expect(res.body).toEqual(generic.body);

      const url = new URL(spy.mock.calls[0][1]);
      expect(url.pathname).toBe('/restablecer-contrasena');
      const token = url.searchParams.get('token');
      await agent().post('/auth/password/reset').send({ token, password: 'NuevaClave2026' }).expect(204);
      await a.get('/auth/me').expect(401);
      const reused = await agent().post('/auth/password/reset').send({ token, password: 'OtraClave2026' }).expect(400);
      expect(reused.body.code).toBe('INVALID_RESET_TOKEN');
      await agent().post('/auth/login').send({ email: email('rosa'), password: 'NuevaClave2026' }).expect(200);
      spy.mockRestore();
    });
  });

  describe('onboarding and trial', () => {
    it('creates tenant, store and owner, and grants a 14-day trial once', async () => {
      const digits = String(Math.floor(1_000_000 + Math.random() * 8_999_999));
      const { agent: a, onboarding } = await registerAndOnboard('owner1', {
        whatsapp: `7${digits.slice(0, 3)} ${digits.slice(3)}`, // typed with a space, as users do
      });
      expect(onboarding.trialGranted).toBe(true);

      const me = await a.get('/auth/me').expect(200);
      expect(me.body).toMatchObject({ needsOnboarding: false, membership: { role: 'OWNER', tenantName: 'Tienda E2E' } });

      const sub = await a.get('/subscription').expect(200);
      expect(sub.body).toMatchObject({
        plan: { code: 'gratis' },
        status: 'TRIALING',
        isOperational: true,
        daysRemaining: 14,
        dataRetentionUntil: null,
        limits: { products: { limit: 30, used: 0 }, users: { limit: 1, used: 1 }, branches: { limit: 1, used: 1 } },
        features: { onlineCatalog: true, advancedReports: true, advancedManagement: false },
      });
      const days = (Date.parse(sub.body.expiresAt) - Date.parse(sub.body.startedAt)) / 86_400_000;
      expect(days).toBe(14);

      const again = await a.post('/onboarding').send(storeBody()).expect(409);
      expect(again.body.code).toBe('ALREADY_ONBOARDED');
    });

    it('does not restart the trial for a business WhatsApp that already used it', async () => {
      const whatsapp = `+5916${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
      await registerAndOnboard('first', { whatsapp });
      const { agent: a, onboarding } = await registerAndOnboard('second', { whatsapp });
      expect(onboarding.trialGranted).toBe(false);
      const sub = await a.get('/subscription').expect(200);
      expect(sub.body).toMatchObject({ status: 'EXPIRED', isOperational: false, daysRemaining: 0 });
    });

    it('validates store data and rejects client-supplied tenant ids', async () => {
      const a = agent();
      await a.post('/auth/register').send({ name: 'Val', email: email('val'), password: PASSWORD }).expect(201);
      const bad = await a.post('/onboarding').send(storeBody({ whatsapp: '123', primaryColor: 'rojo' })).expect(400);
      expect(Object.keys(bad.body.errors).sort()).toEqual(['primaryColor', 'whatsapp']);
      await a.post('/onboarding').send({ ...storeBody(), tenantId: '00000000-0000-0000-0000-000000000000' }).expect(400);
      // Nothing was persisted by the rejected attempts.
      expect((await a.get('/auth/me').expect(200)).body.needsOnboarding).toBe(true);
    });
  });

  describe('store settings and tenant isolation', () => {
    it('updates the store of the authenticated tenant only', async () => {
      const A = await registerAndOnboard('tenantA', { name: 'Tienda A' });
      const B = await registerAndOnboard('tenantB', { name: 'Tienda B' });

      const updated = await A.agent
        .put('/stores/current')
        .send(storeBody({ name: 'Tienda A Renovada', whatsapp: '76543210', address: '', primaryColor: '#ff5c8a' }))
        .expect(200);
      expect(updated.body).toMatchObject({
        name: 'Tienda A Renovada',
        whatsapp: '+59176543210',
        address: null,
        primaryColor: '#FF5C8A',
      });

      const bStore = await B.agent.get('/stores/current').expect(200);
      expect(bStore.body.name).toBe('Tienda B');
      expect(bStore.body.id).toBe(B.onboarding.store.id);

      // B's payment request is invisible and untouchable for A.
      await prisma.platformSettings.update({ where: { id: 1 }, data: { qrEnabled: true } });
      const req = await B.agent.post('/subscription/payment-requests').send({ planCode: 'pro', method: 'QR' }).expect(201);
      expect((await A.agent.get('/subscription/payment-requests').expect(200)).body).toEqual([]);
      await A.agent.get(`/subscription/payment-requests/${req.body.id}`).expect(404);
      const cross = await A.agent.post(`/subscription/payment-requests/${req.body.id}/cancel`).expect(404);
      expect(cross.body.code).toBe('PAYMENT_NOT_FOUND');
      await A.agent.put('/stores/current').send({ ...storeBody(), tenantId: B.onboarding.tenantId }).expect(400);
      expect((await B.agent.get('/stores/current').expect(200)).body.name).toBe('Tienda B');
    });
  });

  describe('subscription', () => {
    it('handles payment requests without activating paid plans', async () => {
      const { agent: a } = await registerAndOnboard('planreq');
      await prisma.platformSettings.update({ where: { id: 1 }, data: { qrEnabled: true } });
      const created = await a.post('/subscription/payment-requests').send({ planCode: 'pro', method: 'QR' }).expect(201);
      expect(created.body).toMatchObject({ status: 'PENDING', amountExpected: '69.00', toPlan: { code: 'pro' } });
      expect((await a.post('/subscription/payment-requests').send({ planCode: 'premium', method: 'QR' }).expect(409)).body.code).toBe('PENDING_REQUEST_EXISTS');
      expect((await a.post('/subscription/payment-requests').send({ planCode: 'gratis', method: 'QR' }).expect(400)).body.code).toBe('PLAN_NOT_PAYABLE');
      expect((await a.get('/subscription').expect(200)).body.plan.code).toBe('gratis');
      expect((await a.post(`/subscription/payment-requests/${created.body.id}/cancel`).expect(200)).body.status).toBe('CANCELED');
      await a.post('/subscription/payment-requests').send({ planCode: 'premium', method: 'QR' }).expect(201);
    });

    it('restricts an expired trial to read-only and keeps the data', async () => {
      const { agent: a, onboarding } = await registerAndOnboard('expired');
      await prisma.subscription.update({
        where: { tenantId: onboarding.tenantId },
        data: { currentPeriodEnd: new Date(Date.now() - 60_000) },
      });
      const sub = await a.get('/subscription').expect(200);
      expect(sub.body).toMatchObject({
        status: 'EXPIRED',
        isOperational: false,
        daysRemaining: 0,
        features: { onlineCatalog: false, inventoryAndSales: false },
      });
      expect(sub.body.dataRetentionUntil).not.toBeNull();
      // Existing data stays readable and the subscription section stays reachable.
      await a.get('/stores/current').expect(200);
      await prisma.platformSettings.update({ where: { id: 1 }, data: { qrEnabled: true } });
      await a.post('/subscription/payment-requests').send({ planCode: 'basico', method: 'QR' }).expect(201);
      const persisted = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: onboarding.tenantId } });
      expect(persisted.status).toBe('TRIALING');
    });
  });
});
