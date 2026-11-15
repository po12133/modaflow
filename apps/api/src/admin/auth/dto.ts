import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MaxLength, MinLength } from 'class-validator';
import { IsStrongPassword, NormalizeEmail } from '../../common/validation.js';

export const STAFF_PASSWORD_MIN = 12;
const STAFF_PASSWORD_MESSAGE = `La contraseña del equipo debe tener al menos ${STAFF_PASSWORD_MIN} caracteres.`;

export class StaffLoginDto {
  @ApiProperty({ example: 'equipo@modaflow.bo' })
  @NormalizeEmail()
  @IsEmail({}, { message: 'Ingresa un correo válido.' })
  @MaxLength(254)
  email!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 128)
  password!: string;
}

export class SetupPasswordDto {
  @ApiProperty({ description: 'Token del enlace de un solo uso generado por el CLI' })
  @IsString()
  @Length(20, 200)
  token!: string;

  @ApiProperty({ minLength: STAFF_PASSWORD_MIN })
  @IsStrongPassword()
  @MinLength(STAFF_PASSWORD_MIN, { message: STAFF_PASSWORD_MESSAGE })
  password!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @Length(1, 128)
  currentPassword!: string;

  @ApiProperty({ minLength: STAFF_PASSWORD_MIN })
  @IsStrongPassword()
  @MinLength(STAFF_PASSWORD_MIN, { message: STAFF_PASSWORD_MESSAGE })
  newPassword!: string;
}
