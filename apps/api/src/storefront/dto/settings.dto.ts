import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { Trim, TrimToNull } from '../../common/validation.js';
import { HEX_COLOR, NormalizeWhatsapp, UppercaseHex, WHATSAPP_E164, WHATSAPP_MESSAGE } from '../../stores/store-fields.js';

const toBool = ({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value);

export class UpdateCatalogSettingsDto {
  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @Length(2, 80) name?: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @TrimToNull() @IsString() @MaxLength(280) description?: string | null;
  @ApiPropertyOptional() @IsOptional() @NormalizeWhatsapp() @Matches(WHATSAPP_E164, { message: WHATSAPP_MESSAGE }) whatsapp?: string;
  @ApiPropertyOptional() @IsOptional() @UppercaseHex() @Matches(HEX_COLOR) primaryColor?: string;
  @ApiPropertyOptional() @IsOptional() @UppercaseHex() @Matches(HEX_COLOR) secondaryColor?: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @TrimToNull() @IsString() @MaxLength(300) welcomeMessage?: string | null;
  @ApiPropertyOptional({ enum: ['SHOW', 'HIDE'] }) @IsOptional() @IsIn(['SHOW', 'HIDE']) outOfStock?: 'SHOW' | 'HIDE';
  @ApiPropertyOptional({ enum: ['PUBLISHED', 'HIDDEN'] }) @IsOptional() @IsIn(['PUBLISHED', 'HIDDEN']) status?: 'PUBLISHED' | 'HIDDEN';
}

export class MediaKindParamDto {
  @IsIn(['logo', 'cover']) kind!: 'logo' | 'cover';
}

export class CatalogProductsQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) search?: string;
  @ApiPropertyOptional({ enum: ['published', 'hidden'] }) @IsOptional() @IsIn(['published', 'hidden']) visibility?: 'published' | 'hidden';
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000) page?: number;
  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

export class PublishProductDto {
  @ApiPropertyOptional() @Transform(toBool) @IsBoolean() catalogPublished!: boolean;
}

export class BulkPublishDto {
  @ApiPropertyOptional({ type: [String] }) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @IsUUID('all', { each: true }) ids!: string[];
  @ApiPropertyOptional() @IsBoolean() catalogPublished!: boolean;
}
