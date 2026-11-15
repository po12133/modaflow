import { generateToken, sha256 } from '../../common/crypto.js';
import type { Prisma } from '../../generated/prisma/client.js';

export const SETUP_TTL_HOURS = 24;

type Db = Pick<Prisma.TransactionClient, 'staffSetupToken' | 'staffSession'>;

export async function issueSetupLink(db: Db, staffId: string, adminWebUrl: string): Promise<{ url: string; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SETUP_TTL_HOURS * 3_600_000);
  await db.staffSetupToken.deleteMany({ where: { staffId, usedAt: null } });
  await db.staffSetupToken.create({ data: { staffId, tokenHash: sha256(token), expiresAt } });
  await db.staffSession.deleteMany({ where: { staffId } });
  return { url: `${adminWebUrl.replace(/\/$/, '')}/acceso?token=${encodeURIComponent(token)}`, expiresAt };
}
