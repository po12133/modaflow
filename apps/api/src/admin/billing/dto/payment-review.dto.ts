import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { Trim, TrimToNull } from '../../../common/validation.js';

export const PAYMENT_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELED'] as const;

export class ApprovePaymentDto {
  @ApiProperty({ description: 'Confirmo que recibí el importe esperado en la cuenta de ModaFlow' }) @IsBoolean() amountVerified!: boolean;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @TrimToNull() @IsString() @MaxLength(500) note?: string | null;
}

export class RejectPaymentDto {
  @ApiProperty() @Trim() @IsString() @Length(5, 500) reason!: string;
}

export class ListPaymentsQueryDto {
  @ApiPropertyOptional({ enum: PAYMENT_STATUSES }) @IsOptional() @IsIn(PAYMENT_STATUSES) status?: (typeof PAYMENT_STATUSES)[number];
  @ApiPropertyOptional() @IsOptional() @IsUUID() planId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() tenantId?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000) page?: number;
  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
