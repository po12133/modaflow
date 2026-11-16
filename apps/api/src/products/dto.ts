import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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
import { Trim, TrimToNull } from '../common/validation.js';
import { MAX_IMAGES_PER_PRODUCT } from '../images/image-processing.js';

/** Money as a decimal string with up to 2 decimals ("69", "69.5", "69.50"). Never floats. */
const MONEY = /^\d{1,9}(\.\d{1,2})?$/;
const toMoneyString = ({ value }: { value: unknown }): unknown => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string') return value.trim().replace(',', '.');
  return value;
};
const SKU = /^[A-Za-z0-9][A-Za-z0-9._-]{1,47}$/;
const SKU_MESSAGE = 'El código solo puede tener letras, números, puntos, guiones y guiones bajos (2 a 48 caracteres).';
const toUpper = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim().toUpperCase() : value);

export class VariantInputDto {
  @ApiPropertyOptional({ example: 'M', nullable: true, description: 'Vacío para talla única' })
  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  size?: string | null;

  @ApiPropertyOptional({ example: 'Rojo', nullable: true, description: 'Vacío = color del producto' })
  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  color?: string | null;

  @ApiProperty({ example: 3, description: 'Stock inicial (se registra como movimiento "Entrada inicial")' })
  @Type(() => Number)
  @IsInt({ message: 'La cantidad debe ser un número entero.' })
  @Min(0, { message: 'La cantidad no puede ser negativa.' })
  @Max(100_000)
  quantity!: number;

  @ApiPropertyOptional({ example: 'P00012-M', description: 'Se genera automáticamente si se omite' })
  @IsOptional()
  @Transform(toUpper)
  @Matches(SKU, { message: SKU_MESSAGE })
  sku?: string;
}

class ProductFieldsDto {
  @ApiProperty({ example: 'Blusa roja de manga larga' })
  @Trim()
  @IsString()
  @Length(2, 120, { message: 'El nombre debe tener entre 2 y 120 caracteres.' })
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({ example: 'Blusa', nullable: true, description: 'Tipo de prenda' })
  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  garmentType?: string | null;

  @ApiPropertyOptional({ example: 'Rojo', nullable: true, description: 'Color principal' })
  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  color?: string | null;

  @ApiPropertyOptional({ type: [String], example: ['Blanco'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  secondaryColors?: string[];

  @ApiPropertyOptional({ example: 'Casual', nullable: true })
  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  style?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Categoría existente de la tienda' })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string | null;

  @ApiPropertyOptional({ example: 'Blusas', description: 'Alternativa a categoryId: se usa o se crea por nombre' })
  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  categoryName?: string | null;

  @ApiPropertyOptional({ type: [String], example: ['casual', 'manga larga'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @ApiProperty({ example: '69.00', description: 'Precio de venta en Bs (obligatorio, lo ingresa la vendedora)' })
  @Transform(toMoneyString)
  @Matches(MONEY, { message: 'Ingresa un precio válido, por ejemplo 69 o 69.50.' })
  salePrice!: string;

  @ApiPropertyOptional({ example: '35.00', nullable: true, description: 'Precio de compra en Bs (opcional)' })
  @Transform(({ value }: { value: unknown }) => (value === '' ? null : toMoneyString({ value })))
  @IsOptional()
  @Matches(MONEY, { message: 'Ingresa un precio de compra válido o déjalo vacío.' })
  purchasePrice?: string | null;

  @ApiPropertyOptional({ example: 2, description: 'Alerta de stock bajo (0 = sin alerta)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  lowStockThreshold?: number;

  @ApiPropertyOptional({ example: 'P00012', description: 'Código del producto; se genera si se omite' })
  @IsOptional()
  @Transform(toUpper)
  @Matches(SKU, { message: SKU_MESSAGE })
  sku?: string;
}

export class CreateProductDto extends ProductFieldsDto {
  @ApiPropertyOptional({
    description: 'Id generado por el cliente al iniciar el registro (borrador). Hace idempotente el guardado y agrupa sus fotos.',
  })
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @ApiProperty({ type: [VariantInputDto], description: 'Al menos una variante (talla única para prendas únicas)' })
  @IsArray()
  @ArrayMinSize(1, { message: 'Agrega al menos una talla o la opción talla única.' })
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => VariantInputDto)
  variants!: VariantInputDto[];

  @ApiPropertyOptional({ type: [String], description: 'Fotos subidas para este producto, en orden' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_IMAGES_PER_PRODUCT, { message: `Cada prenda puede tener hasta ${MAX_IMAGES_PER_PRODUCT} fotos.` })
  @IsUUID('4', { each: true })
  imageIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  primaryImageId?: string;

  @ApiPropertyOptional({ description: 'Análisis IA usado para completar el formulario' })
  @IsOptional()
  @IsUUID('4')
  aiAnalysisId?: string;
}

class VariantUpdateDto {
  @ApiProperty()
  @IsUUID('4')
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  size?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  color?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toUpper)
  @Matches(SKU, { message: SKU_MESSAGE })
  sku?: string;
}

class ImagesUpdateDto {
  @ApiProperty({ type: [String], description: 'Fotos finales en orden; las que falten se eliminan' })
  @IsArray()
  @ArrayMaxSize(MAX_IMAGES_PER_PRODUCT, { message: `Cada prenda puede tener hasta ${MAX_IMAGES_PER_PRODUCT} fotos.` })
  @IsUUID('4', { each: true })
  imageIds!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  primaryImageId?: string;
}

/** Partial update. Stock is never edited here: use inventory movements. */
export class UpdateProductDto {
  @ApiPropertyOptional() @Trim() @IsOptional() @IsString() @Length(2, 120) name?: string;
  @ApiPropertyOptional({ nullable: true }) @TrimToNull() @IsOptional() @IsString() @MaxLength(500) description?: string | null;
  @ApiPropertyOptional({ nullable: true }) @TrimToNull() @IsOptional() @IsString() @MaxLength(60) garmentType?: string | null;
  @ApiPropertyOptional({ nullable: true }) @TrimToNull() @IsOptional() @IsString() @MaxLength(40) color?: string | null;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsString({ each: true }) @MaxLength(40, { each: true })
  secondaryColors?: string[];
  @ApiPropertyOptional({ nullable: true }) @TrimToNull() @IsOptional() @IsString() @MaxLength(60) style?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsUUID('4') categoryId?: string | null;
  @ApiPropertyOptional({ nullable: true }) @TrimToNull() @IsOptional() @IsString() @MaxLength(60) categoryName?: string | null;
  @ApiPropertyOptional({ type: [String], description: 'Reemplaza las etiquetas' })
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(40, { each: true })
  tags?: string[];
  @ApiPropertyOptional({ example: '69.00' })
  @IsOptional() @Transform(toMoneyString) @Matches(MONEY, { message: 'Ingresa un precio válido, por ejemplo 69 o 69.50.' })
  salePrice?: string;
  @ApiPropertyOptional({ nullable: true })
  @Transform(({ value }: { value: unknown }) => (value === '' ? null : toMoneyString({ value })))
  @IsOptional() @Matches(MONEY, { message: 'Ingresa un precio de compra válido o déjalo vacío.' })
  purchasePrice?: string | null;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10_000) lowStockThreshold?: number;
  @ApiPropertyOptional() @IsOptional() @Transform(toUpper) @Matches(SKU, { message: SKU_MESSAGE }) sku?: string;

  @ApiPropertyOptional({ type: ImagesUpdateDto })
  @IsOptional() @ValidateNested() @Type(() => ImagesUpdateDto)
  images?: ImagesUpdateDto;

  @ApiPropertyOptional({ type: [VariantUpdateDto], description: 'Cambiar talla, color o código de variantes existentes' })
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => VariantUpdateDto)
  variantsUpdate?: VariantUpdateDto[];

  @ApiPropertyOptional({ type: [VariantInputDto], description: 'Nuevas variantes con su stock inicial' })
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => VariantInputDto)
  variantsAdd?: VariantInputDto[];
}

export const AVAILABILITY = ['all', 'in_stock', 'low_stock', 'out_of_stock'] as const;
export const PRODUCT_SORTS = ['newest', 'oldest', 'price_asc', 'price_desc', 'name'] as const;

export class ListProductsQueryDto {
  @ApiPropertyOptional({ description: 'Nombre, código/SKU o etiqueta' })
  @IsOptional() @IsString() @MaxLength(80)
  search?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID('4') categoryId?: string;
  @ApiPropertyOptional({ example: 'Rojo' }) @IsOptional() @IsString() @MaxLength(40) color?: string;
  @ApiPropertyOptional({ example: 'M' }) @IsOptional() @IsString() @MaxLength(20) size?: string;

  @ApiPropertyOptional({ enum: AVAILABILITY, default: 'all' })
  @IsOptional() @IsIn(AVAILABILITY)
  availability?: (typeof AVAILABILITY)[number];

  @ApiPropertyOptional({ enum: PRODUCT_SORTS, default: 'newest' })
  @IsOptional() @IsIn(PRODUCT_SORTS)
  sort?: (typeof PRODUCT_SORTS)[number];

  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000) page?: number;
  @ApiPropertyOptional({ default: 20, maximum: 50 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize?: number;
}
