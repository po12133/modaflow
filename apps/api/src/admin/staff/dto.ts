import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { NormalizeEmail, Trim } from '../../common/validation.js';
import { ReasonDto } from '../dto.js';

export const STAFF_ROLES = ['SUPERADMIN', 'SUPPORT'] as const;

export class InviteStaffDto {
  @ApiProperty({ example: 'Ana Pérez' }) @Trim() @IsString() @Length(2, 120) name!: string;
  @ApiProperty({ example: 'ana@modaflow.bo' }) @NormalizeEmail() @IsEmail({}, { message: 'Ingresa un correo válido.' }) @MaxLength(254) email!: string;
  @ApiProperty({ enum: STAFF_ROLES }) @IsIn(STAFF_ROLES) role!: (typeof STAFF_ROLES)[number];
}

export class UpdateStaffDto extends ReasonDto {
  @ApiPropertyOptional({ enum: STAFF_ROLES }) @IsOptional() @IsIn(STAFF_ROLES) role?: (typeof STAFF_ROLES)[number];
  @ApiPropertyOptional({ enum: ['ACTIVE', 'DISABLED'] }) @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: 'ACTIVE' | 'DISABLED';
}
