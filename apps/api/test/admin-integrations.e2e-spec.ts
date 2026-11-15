import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AdminAppModule } from './../src/admin/admin-app.module.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { encryptSecret } from './../src/common/secret-box.js';
import { generateToken, sha256 } from './../src/common/crypto.js';
import { IntegrationConfigService } from './../src/integrations/integration-config.service.js';
import type { PrismaService } from './../src/prisma/prisma.service.js';
import { ownerPrisma, testModule } from './support/db.js';

Object.assign(process.env, {
  SETTINGS_ENCRYPTION_KEY: 'c'.repeat(64),
  ANTHROPIC_API_KEY: '',
  S3_ENDPOINT: process.env['S3_TEST_ENDPOINT'] ?? 'http://localhost:8333',
  S3_PUBLIC_ENDPOINT: '',
  S3_BUCKET: 'modaflow-test',
  S3_ACCESS_KEY_ID: process.env['S3_ACCESS_KEY_ID'] ?? 'modaflow-dev',
  S3_SECRET_ACCESS_KEY: process.env['S3_SECRET_ACCESS_KEY'] ?? 'modaflow-dev-secret',
  S3_FORCE_PATH_STYLE: 'true',
  S3_AUTO_CREATE_BUCKET: 'true',
});

const run = Date.now().toString(36);
const PASSWORD = 'Equipo2026segura';
const FAKE_AI_KEY = `sk-ant-prueba-${run}-0123456789abcdef`;
let ip = 0;

async function boot(module: typeof AppModule | typeof AdminAppModule, role: 'modaflow_app' | 'modaflow_admin') {
  const app = (await testModule(module, role).compile()).createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return app;
}

describe('Integrations editable from the admin panel (e2e)', () => {
  let adminApp: NestExpressApplication;
  let shopApp: NestExpressApplication;
  let prisma: PrismaService;

  const agent = (app: NestExpressApplication) => {
    const forwarded = `198.44.0.${++ip}`;
    const a = request.agent(app.getHttpServer());
    return {
      get: (url: string) => a.get(url).set('X-Forwarded-For', forwarded),
      post: (url: string) => a.post(url).set('X-Forwarded-For', forwarded),
      patch: (url: string) => a.patch(url).set('X-Forwarded-For', forwarded),
    };
  };

  async function staff(name: string, role: 'SUPERADMIN' | 'SUPPORT') {
    const email = `${name}.${run}@equipo.test`;
    const member = await prisma.staff.create({ data: { email, name, role }, select: { id: true } });
    const token = generateToken();
    await prisma.staffSetupToken.create({ data: { staffId: member.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 86_400_000) } });
    const a = agent(adminApp);
    await a.post('/auth/setup-password').send({ token, password: PASSWORD }).expect(204);
    await a.post('/auth/login').send({ email, password: PASSWORD }).expect(200);
    return a;
  }

  beforeAll(async () => {
    adminApp = await boot(AdminAppModule, 'modaflow_admin');
    shopApp = await boot(AppModule, 'modaflow_app');
    prisma = ownerPrisma();
  });

  afterAll(async () => {
    await prisma.integrationSettings.update({ where: { id: 1 }, data: Object.fromEntries(Object.keys(await prisma.integrationSettings.findUniqueOrThrow({ where: { id: 1 } })).filter((k) => !['id', 'updatedAt', 'updatedById'].includes(k)).map((k) => [k, null])) });
    await prisma.$disconnect();
    await adminApp.close();
    await shopApp.close();
  });

  it('saves secrets encrypted, never returns them and requires the current password', async () => {
    const boss = await staff('integra', 'SUPERADMIN');
    const before = (await boss.get('/admin/integrations').expect(200)).body;
    expect(before).toMatchObject({ encryptionReady: true, ai: { active: false }, storage: { active: true, fields: { s3Bucket: { source: 'env', envValue: 'modaflow-test' } } } });

    expect((await boss.patch('/admin/integrations/ai').send({ currentPassword: 'incorrecta', anthropicApiKey: FAKE_AI_KEY }).expect(400)).body.code).toBe('INVALID_PASSWORD');
    const saved = (await boss.patch('/admin/integrations/ai').send({ currentPassword: PASSWORD, anthropicApiKey: FAKE_AI_KEY, anthropicModel: 'claude-sonnet-5-5' }).expect(200)).body;
    expect(saved.ai).toMatchObject({ active: true, fields: { anthropicModel: { value: 'claude-sonnet-5-5', source: 'panel' } }, secrets: { anthropicApiKey: { configured: true, source: 'panel', hint: 'cdef', unreadable: false } } });
    expect(JSON.stringify(saved)).not.toContain(FAKE_AI_KEY);

    const row = await prisma.integrationSettings.findUniqueOrThrow({ where: { id: 1 } });
    expect(row.anthropicApiKeyEnc).toMatch(/^v1:/);
    expect(row.anthropicApiKeyEnc).not.toContain('sk-ant');
    const audit = await prisma.adminAuditLog.findMany({ where: { entityType: 'Integration', entityId: 'ai' }, orderBy: { createdAt: 'desc' }, take: 1 });
    expect(JSON.stringify(audit)).not.toContain(FAKE_AI_KEY);
    expect(audit[0]?.after).toMatchObject({ credentialsReplaced: ['anthropicApiKey'], changed: { anthropicModel: 'claude-sonnet-5-5' } });

    await shopApp.get(IntegrationConfigService).refresh();
    const owner = agent(shopApp);
    await owner.post('/auth/register').send({ name: 'Dueña Integra', email: `duena.${run}@e2e.test`, password: 'Moda2026segura' }).expect(201);
    await owner.post('/onboarding').send({ name: `Tienda Integra ${run}`, whatsapp: `6${Math.floor(1_000_000 + Math.random() * 8_999_999)}`, city: 'Sucre', primaryColor: '#6C4CF5' }).expect(201);
    expect((await owner.get('/ai/usage').expect(200)).body).toMatchObject({ aiConfigured: true, storageConfigured: true });

    await boss.post('/admin/integrations/ai/reset').send({ currentPassword: PASSWORD }).expect(200);
    await shopApp.get(IntegrationConfigService).refresh();
    expect((await owner.get('/ai/usage').expect(200)).body.aiConfigured).toBe(false);
  });

  it('tests a configuration before saving it, without exposing credentials', async () => {
    const boss = await staff('prueba', 'SUPERADMIN');
    const ok = (await boss.post('/admin/integrations/storage/test').send({ currentPassword: PASSWORD }).expect(200)).body;
    expect(ok).toMatchObject({ ok: true });
    const bad = (await boss.post('/admin/integrations/storage/test').send({ currentPassword: PASSWORD, s3SecretAccessKey: 'clave-incorrecta-123' }).expect(200)).body;
    expect(bad.ok).toBe(false);
    expect(JSON.stringify(bad)).not.toContain('clave-incorrecta');
    expect((await boss.post('/admin/integrations/ai/test').send({ currentPassword: PASSWORD }).expect(200)).body).toMatchObject({ ok: false, message: 'Falta la llave de la API de Claude.' });
    const smtp = (await boss.post('/admin/integrations/email/test').send({ currentPassword: PASSWORD, smtpHost: '127.0.0.1', smtpPort: 1, smtpFromEmail: 'no-reply@modaflow.test' }).expect(200)).body;
    expect(smtp).toMatchObject({ ok: false });
    expect((await prisma.integrationSettings.findUniqueOrThrow({ where: { id: 1 } })).smtpHost).toBeNull();
  });

  it('support can only read; an undecryptable secret is reported and disables the section', async () => {
    const support = await staff('lectura', 'SUPPORT');
    await support.get('/admin/integrations').expect(200);
    expect((await support.patch('/admin/integrations/storage').send({ currentPassword: PASSWORD, s3Bucket: 'otro-bucket' }).expect(403)).body.code).toBe('FORBIDDEN_STAFF_ROLE');
    await support.post('/admin/integrations/storage/test').send({ currentPassword: PASSWORD }).expect(403);

    await prisma.integrationSettings.update({ where: { id: 1 }, data: { anthropicApiKeyEnc: encryptSecret('sk-ant-otra-clave-1234567890', 'd'.repeat(64)) } });
    const view = (await support.get('/admin/integrations').expect(200)).body;
    expect(view.ai).toMatchObject({ active: false, secrets: { anthropicApiKey: { source: 'panel', unreadable: true } } });
    await prisma.integrationSettings.update({ where: { id: 1 }, data: { anthropicApiKeyEnc: null } });
  });
});
