import { PrismaPg } from '@prisma/adapter-pg';
import { generateToken, sha256 } from '../common/crypto.js';
import { PrismaClient } from '../generated/prisma/client.js';
import type { StaffRole } from '../generated/prisma/enums.js';

const USAGE = `Uso:
  staff invite <correo> --name "Nombre Apellido" [--role SUPPORT]
  staff reset <correo>      Nuevo enlace para definir contraseña (cierra sus sesiones)
  staff disable <correo>    Desactiva el acceso (no permite dejar sin superadministradores)
  staff enable <correo>
  staff list`;
const SETUP_TTL_HOURS = 24;
const REASON = 'Comando de línea (acceso al servidor)';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Db = PrismaClient;

function option(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function issueLink(db: Db, staffId: string): Promise<string> {
  const token = generateToken();
  await db.$transaction([
    db.staffSetupToken.deleteMany({ where: { staffId, usedAt: null } }),
    db.staffSetupToken.create({ data: { staffId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + SETUP_TTL_HOURS * 3_600_000) } }),
    db.staffSession.deleteMany({ where: { staffId } }),
  ]);
  const base = (process.env['ADMIN_WEB_URL'] ?? 'http://localhost:3002').replace(/\/$/, '');
  return `${base}/acceso?token=${encodeURIComponent(token)}`;
}

async function audit(db: Db, action: string, staffId: string, after: Record<string, string>) {
  await db.adminAuditLog.create({ data: { actorId: null, action, entityType: 'Staff', entityId: staffId, after, reason: REASON } });
}

async function invite(db: Db, email: string, args: string[]) {
  const name = option(args, '--name')?.trim();
  const role: StaffRole = option(args, '--role') === 'SUPPORT' ? 'SUPPORT' : 'SUPERADMIN';
  if (!name || name.length < 2) fail('Indica el nombre con --name "Nombre Apellido".');
  if (await db.staff.findUnique({ where: { email }, select: { id: true } })) fail('Ese correo ya pertenece al equipo. Usa "staff reset" para un enlace nuevo.');
  const staff = await db.staff.create({ data: { email, name, role }, select: { id: true } });
  await audit(db, 'STAFF_INVITED_CLI', staff.id, { role });
  console.log(`Miembro del equipo creado (${role}). Enlace de un solo uso, válido ${SETUP_TTL_HOURS} h:\n${await issueLink(db, staff.id)}`);
}

async function find(db: Db, email: string) {
  return (await db.staff.findUnique({ where: { email }, select: { id: true, role: true, status: true } })) ?? fail('No existe un miembro del equipo con ese correo.');
}

async function reset(db: Db, email: string) {
  const staff = await find(db, email);
  if (staff.status !== 'ACTIVE') fail('El acceso está desactivado. Actívalo primero con "staff enable".');
  const link = await issueLink(db, staff.id);
  await audit(db, 'STAFF_RESET_CLI', staff.id, { status: staff.status });
  console.log(`Enlace de un solo uso, válido ${SETUP_TTL_HOURS} h:\n${link}`);
}

async function setStatus(db: Db, email: string, status: 'ACTIVE' | 'DISABLED') {
  const staff = await find(db, email);
  if (status === 'DISABLED' && staff.role === 'SUPERADMIN') {
    const others = await db.staff.count({ where: { role: 'SUPERADMIN', status: 'ACTIVE', id: { not: staff.id } } });
    if (others === 0) fail('No se puede desactivar al último superadministrador activo.');
  }
  await db.$transaction([
    db.staff.update({ where: { id: staff.id }, data: { status } }),
    db.staffSession.deleteMany({ where: { staffId: staff.id } }),
  ]);
  await audit(db, status === 'ACTIVE' ? 'STAFF_ENABLED_CLI' : 'STAFF_DISABLED_CLI', staff.id, { status });
  console.log(status === 'ACTIVE' ? 'Acceso activado.' : 'Acceso desactivado y sesiones cerradas.');
}

async function list(db: Db) {
  const rows = await db.staff.findMany({ orderBy: { createdAt: 'asc' }, select: { email: true, name: true, role: true, status: true, passwordHash: true, lastLoginAt: true } });
  for (const r of rows) {
    const state = r.status === 'ACTIVE' ? (r.passwordHash ? 'activo' : 'pendiente de contraseña') : 'desactivado';
    console.log(`${r.email}\t${r.role}\t${state}\t${r.name}\túltimo acceso: ${r.lastLoginAt?.toISOString() ?? 'nunca'}`);
  }
  if (rows.length === 0) console.log('Todavía no hay miembros del equipo.');
}

async function main() {
  const [command, rawEmail, ...rest] = process.argv.slice(2);
  const email = rawEmail?.trim().toLowerCase();
  if (!command || (command !== 'list' && (!email || !EMAIL.test(email)))) fail(USAGE);
  const connectionString = process.env['DATABASE_URL'] ?? fail('DATABASE_URL is not set');
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    if (command === 'invite') await invite(db, email!, rest);
    else if (command === 'reset') await reset(db, email!);
    else if (command === 'disable') await setStatus(db, email!, 'DISABLED');
    else if (command === 'enable') await setStatus(db, email!, 'ACTIVE');
    else if (command === 'list') await list(db);
    else fail(USAGE);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('[staff] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
