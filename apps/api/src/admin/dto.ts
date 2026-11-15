import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { Trim } from '../common/validation.js';
import { PLATFORM_METHODS } from '../billing/dto/payments.dto.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const SUBSCRIPTION_STATUSES = ['TRIALING', 'ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELED'] as const;

export class PageQueryDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000) page?: number;
  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

export class TenantsQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: 'Nombre, correo del propietario, WhatsApp o ID' }) @IsOptional() @IsString() @MaxLength(120) search?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^[a-z0-9_-]{2,32}$/) plan?: string;
  @ApiPropertyOptional({ enum: SUBSCRIPTION_STATUSES }) @IsOptional() @IsIn(SUBSCRIPTION_STATUSES) status?: (typeof SUBSCRIPTION_STATUSES)[number];
  @ApiPropertyOptional() @IsOptional() @Matches(DATE) createdFrom?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(DATE) createdTo?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(DATE) expiresFrom?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(DATE) expiresTo?: string;
}

export class UsersQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) search?: string;
  @ApiPropertyOptional({ enum: ['ACTIVE', 'SUSPENDED'] }) @IsOptional() @IsIn(['ACTIVE', 'SUSPENDED']) status?: 'ACTIVE' | 'SUSPENDED';
}

export class ReasonDto {
  @ApiProperty({ description: 'Motivo (queda en el historial y la auditoría)' }) @Trim() @IsString() @Length(5, 500) reason!: string;
}

export class TenantStatusDto extends ReasonDto {
  @ApiProperty({ enum: ['SUSPEND', 'REACTIVATE'] }) @IsIn(['SUSPEND', 'REACTIVATE']) action!: 'SUSPEND' | 'REACTIVATE';
}

export class UserStatusDto extends ReasonDto {
  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED'] }) @IsIn(['ACTIVE', 'SUSPENDED']) status!: 'ACTIVE' | 'SUSPENDED';
}

export class ExtendTrialDto extends ReasonDto {
  @ApiProperty({ minimum: 1, maximum: 60 }) @Type(() => Number) @IsInt() @Min(1) @Max(60) days!: number;
}

export class ManualPaymentDto extends ReasonDto {
  @ApiProperty({ enum: PLATFORM_METHODS }) @IsIn(PLATFORM_METHODS) method!: (typeof PLATFORM_METHODS)[number];
  @ApiProperty({ description: 'Confirmo que el importe del plan ingresó a la cuenta de ModaFlow' }) @IsBoolean() amountVerified!: boolean;
}

export class ChangePlanDto extends ManualPaymentDto {
  @ApiProperty({ example: 'pro' }) @Matches(/^[a-z0-9_-]{2,32}$/) planCode!: string;
}

export class SubscriptionsQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: SUBSCRIPTION_STATUSES }) @IsOptional() @IsIn(SUBSCRIPTION_STATUSES) status?: (typeof SUBSCRIPTION_STATUSES)[number];
  @ApiPropertyOptional() @IsOptional() @Matches(/^[a-z0-9_-]{2,32}$/) plan?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) search?: string;
}

export class UpdatePlanDto {
  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @Length(2, 60) name?: string;
  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @Length(2, 200) tagline?: string;
  @ApiPropertyOptional({ description: 'Precio en centavos (Bs 69 = 6900)' }) @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10_000_000) priceCents?: number;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(366) durationDays?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1_000_000) maxProducts?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100_000) aiAnalysesLimit?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000) maxUsers?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000) maxBranches?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() inventoryAndSales?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() advancedReports?: boolean;
  @ApiPropertyOptional({ enum: ['NONE', 'TEMPORARY', 'FULL'] }) @IsOptional() @IsIn(['NONE', 'TEMPORARY', 'FULL']) onlineCatalog?: 'NONE' | 'TEMPORARY' | 'FULL';
  @ApiPropertyOptional() @IsOptional() @IsBoolean() advancedManagement?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isRecommended?: boolean;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) sortOrder?: number;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(120, { each: true }) highlights?: string[];
  @ApiProperty({ description: 'Motivo del cambio' }) @Trim() @IsString() @Length(5, 500) reason!: string;
}

export class StatsQueryDto {
  @ApiPropertyOptional({ enum: ['today', 'last7', 'this_month', 'last_month', 'this_year', 'custom'] })
  @IsOptional()
  @IsIn(['today', 'last7', 'this_month', 'last_month', 'this_year', 'custom'])
  period?: 'today' | 'last7' | 'this_month' | 'last_month' | 'this_year' | 'custom';
  @ApiPropertyOptional() @IsOptional() @Matches(DATE) from?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(DATE) to?: string;
}

export class AuditQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) entityType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) entityId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() actorId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) action?: string;
}
