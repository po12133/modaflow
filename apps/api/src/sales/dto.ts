import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { TrimToNull } from '../common/validation.js';

export const PAYMENT_METHODS = ['CASH', 'QR', 'TRANSFER', 'OTHER'] as const;
export const DISCOUNT_TYPES = ['PERCENT', 'AMOUNT'] as const;
export const SALE_PERIODS = ['today', 'yesterday', 'last7', 'month', 'custom', 'all'] as const;

const AMOUNT = /^\d{1,9}([.,]\d{1,2})?$/;
const toAmountString = ({ value }: { value: unknown }): unknown => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return typeof value === 'string' ? value.trim() : value;
};

export class DiscountDto {
  @ApiProperty({ enum: DISCOUNT_TYPES, description: 'PERCENT = porcentaje, AMOUNT = monto fijo en Bs' })
  @IsIn(DISCOUNT_TYPES)
  type!: (typeof DISCOUNT_TYPES)[number];

  @ApiProperty({ example: '10', description: 'Porcentaje (0-100) o Bs, hasta 2 decimales' })
  @Transform(toAmountString)
  @Matches(AMOUNT, { message: 'Ingresa un descuento válido, por ejemplo 10 o 10.50.' })
  value!: string;
}

export class SaleItemInputDto {
  @ApiProperty({ description: 'Variante (talla/color) que se vende' })
  @IsUUID('4')
  variantId!: string;

  @ApiProperty({ example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt({ message: 'La cantidad debe ser un número entero.' })
  @Min(1, { message: 'La cantidad debe ser al menos 1.' })
  @Max(10_000)
  quantity!: number;

  @ApiPropertyOptional({ type: DiscountDto, nullable: true, description: 'Descuento por unidad de esta prenda' })
  @IsOptional()
  @ValidateNested()
  @Type(() => DiscountDto)
  discount?: DiscountDto | null;
}

/** Items and discounts of a cart. Prices always come from the database. */
export class CartBaseDto {
  @ApiProperty({ type: [SaleItemInputDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Agrega al menos una prenda.' })
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SaleItemInputDto)
  items!: SaleItemInputDto[];

  @ApiPropertyOptional({ type: DiscountDto, nullable: true, description: 'Descuento general sobre el subtotal ya descontado' })
  @IsOptional()
  @ValidateNested()
  @Type(() => DiscountDto)
  discount?: DiscountDto | null;

  @ApiPropertyOptional({ example: '100', nullable: true, description: 'Efectivo recibido (para calcular el cambio)' })
  @IsOptional()
  @Transform(toAmountString)
  @Matches(AMOUNT, { message: 'Ingresa un monto válido.' })
  amountReceived?: string | null;
}

/** Cart for POST /pos/preview (payment method optional). */
export class CartDto extends CartBaseDto {
  @ApiPropertyOptional({ enum: PAYMENT_METHODS })
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  paymentMethod?: (typeof PAYMENT_METHODS)[number];
}

export class CreateSaleDto extends CartBaseDto {
  @ApiProperty({ enum: PAYMENT_METHODS })
  @IsIn(PAYMENT_METHODS, { message: 'Elige el método de pago.' })
  paymentMethod!: (typeof PAYMENT_METHODS)[number];

  @ApiProperty({ example: true, description: 'La vendedora confirma que recibió el pago' })
  @IsBoolean()
  @Equals(true, { message: 'Confirma que recibiste el pago.' })
  paymentConfirmed!: boolean;

  @ApiProperty({ description: 'Clave única por venta: reintentos no duplican la venta' })
  @Matches(/^[A-Za-z0-9_-]{8,64}$/)
  idempotencyKey!: string;
}

export class CancelSaleDto {
  @ApiProperty({ example: 'Error al registrar la talla' })
  @TrimToNull()
  @IsString({ message: 'Indica el motivo de la anulación.' })
  @Length(3, 200, { message: 'Indica el motivo de la anulación (3 a 200 caracteres).' })
  reason!: string;

  @ApiPropertyOptional({ nullable: true })
  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @ApiPropertyOptional({ description: 'Clave única: repetir la solicitud no falla ni anula dos veces' })
  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]{8,64}$/)
  idempotencyKey?: string;
}

export class ListSalesQueryDto {
  @ApiPropertyOptional({ enum: SALE_PERIODS, default: 'all', description: 'Fechas en hora de Bolivia' })
  @IsOptional()
  @IsIn(SALE_PERIODS)
  period?: (typeof SALE_PERIODS)[number];

  @ApiPropertyOptional({ example: '2026-11-01', description: 'Con period=custom' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiPropertyOptional({ example: '2026-11-30', description: 'Con period=custom' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @ApiPropertyOptional({ enum: ['COMPLETED', 'CANCELED'] })
  @IsOptional()
  @IsIn(['COMPLETED', 'CANCELED'])
  status?: 'COMPLETED' | 'CANCELED';

  @ApiPropertyOptional({ enum: PAYMENT_METHODS })
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  paymentMethod?: (typeof PAYMENT_METHODS)[number];

  @ApiPropertyOptional({ example: 'V-000012' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  number?: string;

  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000) page?: number;
  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize?: number;
}

export class PosProductsQueryDto {
  @ApiPropertyOptional({ description: 'Nombre, SKU, categoría, etiqueta o tipo' }) @IsOptional() @IsString() @MaxLength(80) search?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) color?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) size?: string;
  @ApiPropertyOptional({ description: 'Incluir productos agotados (marcados)' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === true || value === 'true')
  @IsBoolean()
  includeOutOfStock?: boolean;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000) page?: number;
  @ApiPropertyOptional({ default: 24 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60) pageSize?: number;
}
