import { HttpStatus, Injectable } from '@nestjs/common';
import type { UserDto } from '../auth/dto.js';
import { PasswordService } from '../auth/password.service.js';
import { SessionService } from '../auth/session.service.js';
import { AppError } from '../common/app-error.js';
import type { AuthContext } from '../common/request-context.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
  ) {}

  updateProfile(userId: string, name: string): Promise<UserDto> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { name },
      select: { id: true, name: true, email: true, createdAt: true },
    });
  }

  async changePassword(auth: AuthContext, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: auth.userId },
      select: { passwordHash: true },
    });
    if (!(await this.passwords.verify(user.passwordHash, currentPassword))) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'INVALID_CURRENT_PASSWORD', 'La contraseña actual no es correcta.');
    }
    await this.prisma.user.update({
      where: { id: auth.userId },
      data: { passwordHash: await this.passwords.hash(newPassword) },
    });
    await this.sessions.revokeAllForUser(auth.userId, auth.sessionId);
  }
}
