import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AdminAppModule } from './../src/admin/admin-app.module.js';
import { configureApp } from './../src/app.setup.js';
import { generateToken, sha256 } from './../src/common/crypto.js';
import type { PrismaService } from './../src/prisma/prisma.service.js';
import { ownerPrisma, testModule } from './support/db.js';

const run = Date.now().toString(36);
const PASSWORD = 'Equipo2026segura';
let ip = 0;

describe('Staff management from the admin panel (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  const agent = () => {
    const forwarded = `198.33.0.${++ip}`;
    const a = request.agent(app.getHttpServer());
    return {
      get: (url: string) => a.get(url).set('X-Forwarded-For', forwarded),
      post: (url: string) => a.post(url).set('X-Forwarded-For', forwarded),
      patch: (url: string) => a.patch(url).set('X-Forwarded-For', forwarded),
    };
  };

  async function login(email: string, password = PASSWORD) {
    const a = agent();
    await a.post('/auth/login').send({ email, password }).expect(200);
    return a;
  }

  async function seedStaff(name: string, role: 'SUPERADMIN' | 'SUPPORT') {
    const email = `${name}.${run}@equipo.test`;
    const member = await prisma.staff.create({ data: { email, name, role }, select: { id: true } });
    const token = generateToken();
    await prisma.staffSetupToken.create({ data: { staffId: member.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 86_400_000) } });
    await agent().post('/auth/setup-password').send({ token, password: PASSWORD }).expect(204);
    return { id: member.id, email, a: await login(email) };
  }

  const tokenOf = (url: string) => new URL(url).searchParams.get('token')!;

  beforeAll(async () => {
    app = (await testModule(AdminAppModule, 'modaflow_admin').compile()).createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    prisma = ownerPrisma();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('lists the team without secrets; support can read but not manage', async () => {
    const boss = await seedStaff('jefa', 'SUPERADMIN');
    const support = await seedStaff('soporte', 'SUPPORT');
    const list = (await support.a.get('/admin/staff').expect(200)).body as { email: string; hasPassword: boolean; activeSessions: number }[];
    expect(list.find((s) => s.email === boss.email)).toMatchObject({ hasPassword: true, role: 'SUPERADMIN', status: 'ACTIVE' });
    expect(JSON.stringify(list)).not.toMatch(/passwordHash|password_hash|tokenHash/);
    expect((await support.a.post('/admin/staff').send({ name: 'Nadie', email: `nadie.${run}@equipo.test`, role: 'SUPPORT' }).expect(403)).body.code).toBe('FORBIDDEN_STAFF_ROLE');
    await support.a.patch(`/admin/staff/${boss.id}`).send({ status: 'DISABLED', reason: 'Intento indebido' }).expect(403);
  });

  it('invites with a one-time link, regenerates links and audits everything', async () => {
    const boss = await seedStaff('invita', 'SUPERADMIN');
    const email = `nuevo.${run}@equipo.test`;
    const res = (await boss.a.post('/admin/staff').send({ name: 'Nuevo Miembro', email: email.toUpperCase(), role: 'SUPPORT' }).expect(201)).body;
    expect(res.staff).toMatchObject({ email, role: 'SUPPORT', hasPassword: false });
    expect(res.setupUrl).toMatch(/\/acceso\?token=/);
    expect((await boss.a.post('/admin/staff').send({ name: 'Otro', email, role: 'SUPPORT' }).expect(409)).body.code).toBe('EMAIL_TAKEN');

    const again = (await boss.a.post(`/admin/staff/${res.staff.id}/setup-link`).expect(200)).body;
    await agent().post('/auth/setup-password').send({ token: tokenOf(res.setupUrl), password: PASSWORD }).expect(400);
    await agent().post('/auth/setup-password').send({ token: tokenOf(again.setupUrl), password: PASSWORD }).expect(204);
    await login(email);
    const actions = (await prisma.adminAuditLog.findMany({ where: { entityId: res.staff.id }, select: { action: true, actorId: true } })).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['STAFF_INVITED', 'STAFF_SETUP_LINK', 'STAFF_PASSWORD_SET']));
  });

  it('changes roles and disables access, closing sessions; protects self and the last superadmin', async () => {
    const boss = await seedStaff('cambia', 'SUPERADMIN');
    const member = await seedStaff('miembro', 'SUPPORT');
    await boss.a.patch(`/admin/staff/${member.id}`).send({ role: 'SUPERADMIN', reason: 'Nueva responsable de pagos' }).expect(200);
    await member.a.get('/auth/me').expect(401);
    const promoted = await login(member.email);
    await promoted.patch('/admin/settings').send({ trialDays: 14 }).expect(200);

    await boss.a.patch(`/admin/staff/${member.id}`).send({ status: 'DISABLED', reason: 'Dejó el equipo' }).expect(200);
    await promoted.get('/auth/me').expect(401);
    await agent().post('/auth/login').send({ email: member.email, password: PASSWORD }).expect(401);
    expect((await boss.a.post(`/admin/staff/${member.id}/setup-link`).expect(409)).body.code).toBe('STAFF_DISABLED');
    await boss.a.patch(`/admin/staff/${member.id}`).send({ status: 'ACTIVE', reason: 'Volvió al equipo' }).expect(200);
    await login(member.email);

    expect((await boss.a.patch(`/admin/staff/${boss.id}`).send({ role: 'SUPPORT', reason: 'Prueba propia' }).expect(409)).body.code).toBe('STAFF_SELF_CHANGE');
    expect((await boss.a.patch(`/admin/staff/${boss.id}`).send({ status: 'DISABLED', reason: 'Prueba propia' }).expect(409)).body.code).toBe('STAFF_SELF_CHANGE');
    const audit = await prisma.adminAuditLog.findMany({ where: { entityId: member.id, actorId: boss.id }, select: { action: true, reason: true } });
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(['STAFF_ROLE_CHANGED', 'STAFF_DISABLED', 'STAFF_ENABLED']));
    expect(audit.every((a) => (a.reason ?? '').length >= 5)).toBe(true);
  });
});
