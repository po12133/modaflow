import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { PAYMENT_METHODS } from '../sales/dto.js';
import { REPORT_PERIODS, type ReportPeriod } from './report-period.types.js';

const toBool = ({ value }: { value: unknown }) => value === true || value === 'true' || value === '1';

export class PeriodQueryDto {
  @ApiPropertyOptional({ enum: REPORT_PERIODS, default: 'this_month', description: 'En la zona horaria de la tienda' })
  @IsOptional()
  @IsIn(REPORT_PERIODS)
  period?: ReportPeriod;

  @ApiPropertyOptional({ example: '2026-11-01', description: 'Fecha inicial (period=custom)' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Usa el formato AAAA-MM-DD.' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-11-30', description: 'Fecha final inclusive (period=custom)' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Usa el formato AAAA-MM-DD.' })
  to?: string;
}

export class SalesReportQueryDto extends PeriodQueryDto {
  @ApiPropertyOptional({ enum: PAYMENT_METHODS }) @IsOptional() @IsIn(PAYMENT_METHODS) paymentMethod?: (typeof PAYMENT_METHODS)[number];
  @ApiPropertyOptional({ description: 'Usuario vendedor' }) @IsOptional() @IsUUID() sellerId?: string;
  @ApiPropertyOptional({ enum: ['COMPLETED', 'CANCELED'] }) @IsOptional() @IsIn(['COMPLETED', 'CANCELED']) status?: 'COMPLETED' | 'CANCELED';
  @ApiPropertyOptional({ example: 'V-000012' }) @IsOptional() @IsString() @MaxLength(20) number?: string;
  @ApiPropertyOptional({ enum: ['desc', 'asc'], default: 'desc', description: 'Orden por fecha' }) @IsOptional() @IsIn(['desc', 'asc']) sort?: 'desc' | 'asc';
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100_000) page?: number;
  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

export const PRODUCT_SORTS = ['units_desc', 'units_asc', 'revenue_desc', 'revenue_asc'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export class ProductsReportQueryDto extends PeriodQueryDto {
  @ApiPropertyOptional({ description: 'Categoría al momento de la venta' }) @IsOptional() @IsUUID() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() productId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() variantId?: string;
  @ApiPropertyOptional({ description: 'Nombre del producto' }) @IsOptional() @IsString() @MaxLength(80) search?: string;
  @ApiPropertyOptional({ enum: PRODUCT_SORTS, default: 'units_desc' }) @IsOptional() @IsIn(PRODUCT_SORTS) sort?: ProductSort;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100_000) page?: number;
  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

export class InventoryReportQueryDto extends PeriodQueryDto {
  @ApiPropertyOptional({ description: 'Umbral de stock bajo (si se omite, el de cada producto)', minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  lowStock?: number;

  @ApiPropertyOptional({ default: false, description: 'Incluir prendas únicas (1 unidad, talla única) en stock bajo' })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  includeUnique?: boolean;
}

export const EXPORT_REPORTS = ['summary', 'sales', 'products', 'inventory'] as const;
export type ExportReport = (typeof EXPORT_REPORTS)[number];

export class ExportQueryDto extends PeriodQueryDto {
  @ApiPropertyOptional({ enum: EXPORT_REPORTS, default: 'summary' }) @IsOptional() @IsIn(EXPORT_REPORTS) report?: ExportReport;
  @ApiPropertyOptional({ enum: PAYMENT_METHODS }) @IsOptional() @IsIn(PAYMENT_METHODS) paymentMethod?: (typeof PAYMENT_METHODS)[number];
  @ApiPropertyOptional() @IsOptional() @IsUUID() sellerId?: string;
  @ApiPropertyOptional({ enum: ['COMPLETED', 'CANCELED'] }) @IsOptional() @IsIn(['COMPLETED', 'CANCELED']) status?: 'COMPLETED' | 'CANCELED';
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() productId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) search?: string;
  @ApiPropertyOptional({ enum: PRODUCT_SORTS }) @IsOptional() @IsIn(PRODUCT_SORTS) sort?: ProductSort;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) lowStock?: number;
  @ApiPropertyOptional() @IsOptional() @Transform(toBool) @IsBoolean() includeUnique?: boolean;
}
