import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { TrimToNull } from '../common/validation.js';
import { AVAILABILITY } from '../products/dto.js';

export const MOVEMENT_TYPES = ['INITIAL', 'STOCK_IN', 'MANUAL_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT'] as const;

class MovementBaseDto {
  @ApiProperty({ description: 'Variante (talla/color) cuyo stock cambia' })
  @IsUUID('4')
  variantId!: string;

  @ApiProperty({ example: 5, minimum: 1 })
  @Type(() => Number)
  @IsInt({ message: 'La cantidad debe ser un número entero.' })
  @Min(1, { message: 'La cantidad debe ser mayor a 0.' })
  @Max(100_000)
  quantity!: number;

  @ApiPropertyOptional({ example: 'Factura 123', nullable: true, description: 'Referencia de la operación' })
  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  reference?: string | null;

  @ApiProperty({ description: 'Clave única generada por el cliente: un reintento no registra el movimiento dos veces' })
  @Matches(/^[A-Za-z0-9_-]{8,64}$/)
  idempotencyKey!: string;
}

export class StockEntryDto extends MovementBaseDto {
  @ApiPropertyOptional({ example: 'Llegó mercadería del fardo', nullable: true })
  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string | null;
}

export class StockExitDto extends MovementBaseDto {
  @ApiProperty({ example: 'Prenda dañada' })
  @TrimToNull()
  @IsString({ message: 'Indica el motivo de la salida.' })
  @Length(3, 200, { message: 'Indica el motivo de la salida (3 a 200 caracteres).' })
  reason!: string;
}

export class StockAdjustmentDto extends MovementBaseDto {
  @ApiProperty({ enum: ['IN', 'OUT'], description: 'IN = ajuste positivo, OUT = ajuste negativo' })
  @IsIn(['IN', 'OUT'])
  direction!: 'IN' | 'OUT';

  @ApiProperty({ example: 'Conteo físico' })
  @TrimToNull()
  @IsString({ message: 'Indica el motivo del ajuste.' })
  @Length(3, 200, { message: 'Indica el motivo del ajuste (3 a 200 caracteres).' })
  reason!: string;
}

export class InventoryQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) search?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') categoryId?: string;
  @ApiPropertyOptional({ enum: AVAILABILITY }) @IsOptional() @IsIn(AVAILABILITY) availability?: (typeof AVAILABILITY)[number];
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000) page?: number;
  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize?: number;
}

export class MovementsQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') productId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') variantId?: string;
  @ApiPropertyOptional({ enum: MOVEMENT_TYPES }) @IsOptional() @IsIn(MOVEMENT_TYPES) type?: (typeof MOVEMENT_TYPES)[number];
  @ApiPropertyOptional({ example: '2026-11-01' }) @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional({ example: '2026-11-30' }) @IsOptional() @IsDateString() to?: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000) page?: number;
  @ApiPropertyOptional({ default: 30 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
