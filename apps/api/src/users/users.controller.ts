import { Body, Controller, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { CurrentAuth } from '../auth/decorators.js';
import { UserDto } from '../auth/dto.js';
import { SESSION_COOKIE } from '../auth/session.service.js';
import type { AuthContext } from '../common/request-context.js';
import { IsStrongPassword, Trim } from '../common/validation.js';
import { UsersService } from './users.service.js';

export class UpdateProfileDto {
  @ApiProperty({ example: 'Carla Méndez' })
  @Trim()
  @IsString()
  @Length(2, 120, { message: 'El nombre debe tener entre 2 y 120 caracteres.' })
  name!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @Length(1, 128)
  currentPassword!: string;

  @ApiProperty({ example: 'NuevaClave2026' })
  @IsStrongPassword()
  newPassword!: string;
}

@ApiTags('users')
@ApiCookieAuth(SESSION_COOKIE)
@Controller('users/me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Patch()
  @ApiOperation({ summary: 'Actualizar el perfil del usuario autenticado' })
  @ApiOkResponse({ type: UserDto })
  updateProfile(@CurrentAuth() auth: AuthContext, @Body() dto: UpdateProfileDto): Promise<UserDto> {
    return this.users.updateProfile(auth.userId, dto.name);
  }

  @Post('password')
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cambiar contraseña (cierra las demás sesiones)' })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'INVALID_CURRENT_PASSWORD o contraseña nueva inválida' })
  async changePassword(@CurrentAuth() auth: AuthContext, @Body() dto: ChangePasswordDto): Promise<void> {
    await this.users.changePassword(auth, dto.currentPassword, dto.newPassword);
  }
}
