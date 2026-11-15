import type { Type } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { PrismaService } from '../../src/prisma/prisma.service.js';

const ownerUrl = new URL(process.env['DATABASE_URL'] ?? 'postgresql://x/none');
if (!ownerUrl.pathname.slice(1).endsWith('_test')) throw new Error(`E2E tests must run on a *_test database (got "${ownerUrl.pathname.slice(1)}").`);

const PASSWORDS = {
  modaflow_app: process.env['APP_DB_PASSWORD'] ?? 'modaflow_app_dev_password',
  modaflow_admin: process.env['ADMIN_DB_PASSWORD'] ?? 'modaflow_admin_dev_password',
};
export type DbRole = keyof typeof PASSWORDS;

export function roleUrl(role: DbRole): string {
  const url = new URL(ownerUrl);
  url.username = role;
  url.password = PASSWORDS[role];
  return url.toString();
}

export function prismaFor(url: string): PrismaService {
  return new PrismaService({ get: () => url } as unknown as ConfigService<never, true>);
}

export const ownerPrisma = () => prismaFor(ownerUrl.toString());

export function testModule(module: Type, role: DbRole): TestingModuleBuilder {
  return Test.createTestingModule({ imports: [module] }).overrideProvider(PrismaService).useValue(prismaFor(roleUrl(role)));
}
