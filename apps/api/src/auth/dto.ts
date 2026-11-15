import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';
import { IsStrongPassword, NormalizeEmail, Trim } from '../common/validation.js';
import type { MembershipRole } from '../generated/prisma/enums.js';

export class RegisterDto {
  @ApiProperty({ example: 'Carla Méndez' })
  @Trim()
  @IsString()
  @Length(2, 120, { message: 'El nombre debe tener entre 2 y 120 caracteres.' })
  name!: string;

  @ApiProperty({ example: 'carla@mitienda.bo' })
  @NormalizeEmail()
  @IsEmail({}, { message: 'Ingresa un correo válido.' })
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'Moda2026segura', minLength: 8 })
  @IsStrongPassword()
  password!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'carla@mitienda.bo' })
  @NormalizeEmail()
  @IsEmail({}, { message: 'Ingresa un correo válido.' })
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'Moda2026segura' })
  @IsString()
  @Length(1, 128)
  password!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'carla@mitienda.bo' })
  @NormalizeEmail()
  @IsEmail({}, { message: 'Ingresa un correo válido.' })
  @MaxLength(254)
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token recibido en el enlace de recuperación' })
  @IsString()
  @Length(20, 200)
  token!: string;

  @ApiProperty({ example: 'NuevaClave2026' })
  @IsStrongPassword()
  password!: string;
}

export class UserDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() email!: string;
  @ApiProperty() createdAt!: Date;
}

export class MembershipDto {
  @ApiProperty() tenantId!: string;
  @ApiProperty() tenantName!: string;
  @ApiProperty({ enum: ['OWNER', 'ADMIN', 'SELLER'] }) role!: MembershipRole;
}

export class MeDto {
  @ApiProperty({ type: UserDto }) user!: UserDto;
  @ApiProperty({ type: MembershipDto, nullable: true, description: 'Tenant activo; null si aún no creó su tienda' })
  membership!: MembershipDto | null;
  @ApiProperty({ description: 'true cuando el usuario debe completar la configuración inicial de su tienda' })
  needsOnboarding!: boolean;
}

export class MessageDto {
  @ApiProperty() message!: string;
}
