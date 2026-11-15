import type { ConfigService } from '@nestjs/config';
import type { MailService } from '../mail/mail.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AuthService, LOCKOUT_MINUTES, MAX_FAILED_LOGINS } from './auth.service.js';
import { PasswordService } from './password.service.js';
import type { SessionService } from './session.service.js';

describe('AuthService.login', () => {
  const passwords = new PasswordService();
  let prisma: {
    user: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    tenantMembership: { findFirst: ReturnType<typeof vi.fn> };
  };
  let sessions: { create: ReturnType<typeof vi.fn> };
  let service: AuthService;
  let user: Record<string, unknown>;

  beforeEach(async () => {
    user = {
      id: 'u1',
      name: 'Carla',
      email: 'carla@test.bo',
      passwordHash: await passwords.hash('Moda2026segura'),
      failedLoginAttempts: 0,
      lockedUntil: null,
      createdAt: new Date(),
    };
    prisma = {
      user: { findUnique: vi.fn().mockResolvedValue(user), update: vi.fn().mockResolvedValue(user) },
      tenantMembership: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    sessions = { create: vi.fn().mockResolvedValue({ token: 'tok', expiresAt: new Date() }) };
    const config = { get: () => 'http://localhost:3000' } as unknown as ConfigService;
    service = new AuthService(
      prisma as unknown as PrismaService,
      passwords,
      sessions as unknown as SessionService,
      {} as MailService,
      config as never,
    );
  });

  it('creates a session with valid credentials and resets the failure counter', async () => {
    const result = await service.login({ email: 'carla@test.bo', password: 'Moda2026segura' }, {});
    expect(result.session.token).toBe('tok');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ failedLoginAttempts: 0, lockedUntil: null }) }),
    );
  });

  it('rejects a wrong password and counts the failure', async () => {
    await expect(service.login({ email: 'carla@test.bo', password: 'otra' }, {})).rejects.toMatchObject({
      response: { code: 'INVALID_CREDENTIALS' },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { failedLoginAttempts: 1 } });
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it(`locks the account after ${MAX_FAILED_LOGINS} consecutive failures`, async () => {
    user.failedLoginAttempts = MAX_FAILED_LOGINS - 1;
    await expect(service.login({ email: 'carla@test.bo', password: 'otra' }, {})).rejects.toBeDefined();
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.failedLoginAttempts).toBe(0);
    expect(data.lockedUntil.getTime()).toBeGreaterThan(Date.now() + (LOCKOUT_MINUTES - 1) * 60_000);
  });

  it('refuses even the right password while locked', async () => {
    user.lockedUntil = new Date(Date.now() + 5 * 60_000);
    await expect(service.login({ email: 'carla@test.bo', password: 'Moda2026segura' }, {})).rejects.toMatchObject({
      response: { code: 'ACCOUNT_LOCKED' },
    });
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('answers unknown emails with the same error', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.login({ email: 'nadie@test.bo', password: 'x' }, {})).rejects.toMatchObject({
      response: { code: 'INVALID_CREDENTIALS' },
    });
  });
});
