import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

async function main() {
  const args = process.argv.slice(2);
  const email = args.find((a) => !a.startsWith('--'))?.trim().toLowerCase();
  const revoke = args.includes('--revoke');
  const roleArg = args[args.indexOf('--role') + 1];
  const role = args.includes('--role') && roleArg === 'SUPPORT' ? 'SUPPORT' : 'SUPERADMIN';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('Uso: grant-superadmin <correo-de-un-usuario-registrado> [--role SUPPORT] [--revoke]');
    process.exit(2);
  }
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, globalRole: true, status: true } });
    if (!user) {
      console.error('No existe un usuario registrado con ese correo. Regístralo primero desde la aplicación.');
      process.exit(1);
    }
    if (revoke) {
      const others = await prisma.user.count({ where: { globalRole: 'SUPERADMIN', status: 'ACTIVE', id: { not: user.id } } });
      if (user.globalRole === 'SUPERADMIN' && others === 0) {
        console.error('No se puede quitar el rol al último superadministrador activo.');
        process.exit(1);
      }
    }
    const next = revoke ? null : role;
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { globalRole: next } }),
      prisma.session.deleteMany({ where: { userId: user.id } }),
      prisma.adminAuditLog.create({
        data: { actorId: user.id, action: revoke ? 'GLOBAL_ROLE_REVOKED_CLI' : 'GLOBAL_ROLE_GRANTED_CLI', entityType: 'User', entityId: user.id, before: { globalRole: user.globalRole }, after: { globalRole: next }, reason: 'Comando de línea (acceso al servidor)' },
      }),
    ]);
    console.log(revoke ? `Rol global retirado a ${email}.` : `${email} ahora es ${role}. Debe iniciar sesión de nuevo.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('[grant-superadmin] failed:', error);
  process.exit(1);
});
