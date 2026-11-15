import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { StaffRole } from '../../generated/prisma/enums.js';

export interface StaffContext {
  staffId: string;
  sessionId: string;
  role: StaffRole;
}

export interface AdminRequest extends Request {
  staff?: StaffContext;
}

export const CurrentStaff = createParamDecorator((_data: unknown, ctx: ExecutionContext): StaffContext => {
  const req = ctx.switchToHttp().getRequest<AdminRequest>();
  if (!req.staff) throw new Error('CurrentStaff used on a route without StaffSessionGuard');
  return req.staff;
});
