import type { Request } from 'express';
import type { MembershipRole } from '../generated/prisma/enums.js';

export interface AuthContext {
  userId: string;
  sessionId: string;
  activeTenantId: string | null;
}

export interface TenantContext {
  tenantId: string;
  role: MembershipRole;
}

/** Express request enriched by SessionGuard (auth) and TenantGuard (tenant). */
export interface AppRequest extends Request {
  auth?: AuthContext;
  tenant?: TenantContext;
}
