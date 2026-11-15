import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../../auth/decorators.js';
import { clientIp } from '../../common/client-ip.js';
import { ChangePasswordDto, SetupPasswordDto, StaffLoginDto } from './dto.js';
import { StaffAuthService } from './staff-auth.service.js';
import { type AdminRequest, CurrentStaff, type StaffContext } from './staff-context.js';
import { ADMIN_SESSION_COOKIE, StaffSessionService } from './staff-session.service.js';

const LOGIN_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('admin auth')
@Controller('auth')
export class StaffAuthController {
  constructor(
    private readonly auth: StaffAuthService,
    private readonly sessions: StaffSessionService,
  ) {}

  @Public()
  @Throttle(LOGIN_THROTTLE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión del equipo de ModaFlow (cookie HttpOnly, sesión corta)' })
  async login(@Body() dto: StaffLoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { staff, session } = await this.auth.login(dto, { ipAddress: clientIp(req) ?? undefined, userAgent: req.get('user-agent') });
    this.sessions.setCookie(res, session.token, session.expiresAt);
    return staff;
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: AdminRequest, @Res({ passthrough: true }) res: Response) {
    if (req.staff) await this.sessions.revoke(req.staff.sessionId);
    this.sessions.clearCookie(res);
  }

  @Get('me')
  @ApiCookieAuth(ADMIN_SESSION_COOKIE)
  me(@CurrentStaff() staff: StaffContext) {
    return this.auth.me(staff.staffId);
  }

  @Public()
  @Throttle(LOGIN_THROTTLE)
  @Post('setup-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Definir la contraseña con el enlace de un solo uso generado por el CLI' })
  async setupPassword(@Body() dto: SetupPasswordDto, @Req() req: Request) {
    await this.auth.setupPassword(dto, clientIp(req));
  }

  @Post('password')
  @Throttle(LOGIN_THROTTLE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth(ADMIN_SESSION_COOKIE)
  @ApiOperation({ summary: 'Cambiar la contraseña propia (cierra las demás sesiones)' })
  async changePassword(@CurrentStaff() staff: StaffContext, @Body() dto: ChangePasswordDto, @Req() req: Request) {
    await this.auth.changePassword(staff.staffId, staff.sessionId, dto, clientIp(req));
  }
}
