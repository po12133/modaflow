import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsNumberString, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { MAX_LINE_QUANTITY, MAX_REQUEST_LINES } from '../storefront-rules.js';

export const PUBLIC_SORTS = ['newest', 'price_asc', 'price_desc', 'name'] as const;
export type PublicSort = (typeof PUBLIC_SORTS)[number];

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class StoreSlugParamDto {
  @Matches(SLUG) @MaxLength(60) slug!: string;
}

export class ProductSlugParamDto extends StoreSlugParamDto {
  @Matches(SLUG) @MaxLength(160) productSlug!: string;
}

export class RequestCodeParamDto extends StoreSlugParamDto {
  @Matches(/^[A-Z0-9]{6,12}$/) code!: string;
}

export class PublicProductsQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) search?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(SLUG) @MaxLength(80) category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) size?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) color?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumberString() minPrice?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumberString() maxPrice?: string;
  @ApiPropertyOptional({ enum: ['all', 'available'] }) @IsOptional() @IsIn(['all', 'available']) availability?: 'all' | 'available';
  @ApiPropertyOptional({ enum: PUBLIC_SORTS }) @IsOptional() @IsIn(PUBLIC_SORTS) sort?: PublicSort;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000) page?: number;
  @ApiPropertyOptional({ default: 24 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(48) pageSize?: number;
}

export class OrderLineDto {
  @Matches(SLUG) @MaxLength(160) productSlug!: string;
  @IsString() @MaxLength(48) sku!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(MAX_LINE_QUANTITY) quantity!: number;
}

export class CreateOrderRequestDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(MAX_REQUEST_LINES) @ValidateNested({ each: true }) @Type(() => OrderLineDto) items!: OrderLineDto[];
}

export class OpenedDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{20,64}$/) token!: string;
}
