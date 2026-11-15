import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { AuthContext } from '../common/request-context.js';
import { AuthService } from './auth.service.js';
import { CurrentAuth, Public } from './decorators.js';
import { ForgotPasswordDto, LoginDto, MeDto, MessageDto, RegisterDto, ResetPasswordDto, UserDto } from './dto.js';
import { SESSION_COOKIE, type SessionMeta, SessionService } from './session.service.js';

/** Stricter per-IP limits for credential endpoints (on top of account lockout). */
const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };
const RESET_THROTTLE = { default: { limit: 5, ttl: 15 * 60_000 } };

function sessionMeta(req: Request): SessionMeta {
  return { ipAddress: req.ip, userAgent: req.get('user-agent') };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('register')
  @ApiOperation({ summary: 'Crear cuenta e iniciar sesión (cookie HttpOnly)' })
  @ApiCreatedResponse({ type: UserDto })
  @ApiConflictResponse({ description: 'EMAIL_TAKEN' })
  @ApiTooManyRequestsResponse({ description: 'Demasiadas solicitudes' })
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { user, session } = await this.auth.register(dto, sessionMeta(req));
    this.sessions.setCookie(res, session.token, session.expiresAt);
    return user;
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión (cookie HttpOnly)' })
  @ApiOkResponse({ type: UserDto })
  @ApiUnauthorizedResponse({ description: 'INVALID_CREDENTIALS' })
  @ApiTooManyRequestsResponse({ description: 'ACCOUNT_LOCKED o demasiadas solicitudes' })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { user, session } = await this.auth.login(dto, sessionMeta(req));
    this.sessions.setCookie(res, session.token, session.expiresAt);
    return user;
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cerrar sesión (revoca la sesión y borra la cookie)' })
  @ApiNoContentResponse()
  async logout(@Req() req: Request & { auth?: AuthContext }, @Res({ passthrough: true }) res: Response) {
    if (req.auth) await this.sessions.revoke(req.auth.sessionId);
    this.sessions.clearCookie(res);
  }

  @Get('me')
  @ApiCookieAuth(SESSION_COOKIE)
  @ApiOperation({ summary: 'Usuario autenticado y su tienda activa' })
  @ApiOkResponse({ type: MeDto })
  @ApiUnauthorizedResponse({ description: 'UNAUTHENTICATED' })
  me(@CurrentAuth() auth: AuthContext): Promise<MeDto> {
    return this.auth.me(auth.userId, auth.activeTenantId);
  }

  @Public()
  @Throttle(RESET_THROTTLE)
  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Solicitar enlace de recuperación (respuesta idéntica exista o no la cuenta)' })
  @ApiAcceptedResponse({ type: MessageDto })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<MessageDto> {
    await this.auth.requestPasswordReset(dto.email);
    return { message: 'Si existe una cuenta con ese correo, te enviaremos instrucciones para recuperarla.' };
  }

  @Public()
  @Throttle(RESET_THROTTLE)
  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Definir nueva contraseña con el token de recuperación (cierra todas las sesiones)' })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'INVALID_RESET_TOKEN o contraseña inválida' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.auth.resetPassword(dto.token, dto.password);
  }
}
