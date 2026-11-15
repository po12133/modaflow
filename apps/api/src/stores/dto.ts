import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { Trim, TrimToNull } from '../common/validation.js';
import { HEX_COLOR, NormalizeWhatsapp, UppercaseHex, WHATSAPP_E164, WHATSAPP_MESSAGE } from './store-fields.js';

/** Editable store fields, shared by onboarding and settings. */
export class StoreFieldsDto {
  @ApiProperty({ example: 'MioShop', description: 'Nombre comercial' })
  @Trim()
  @IsString()
  @Length(2, 80, { message: 'El nombre comercial debe tener entre 2 y 80 caracteres.' })
  name!: string;

  @ApiPropertyOptional({ example: 'Moda femenina en Cochabamba', nullable: true })
  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(280, { message: 'La descripción no puede superar 280 caracteres.' })
  description?: string | null;

  @ApiProperty({ example: '+59171234567', description: 'Se aceptan 8 dígitos bolivianos (7xxxxxxx) o formato internacional' })
  @NormalizeWhatsapp()
  @IsString()
  @Matches(WHATSAPP_E164, { message: WHATSAPP_MESSAGE })
  whatsapp!: string;

  @ApiProperty({ example: 'Cochabamba' })
  @Trim()
  @IsString()
  @Length(2, 80, { message: 'La ciudad debe tener entre 2 y 80 caracteres.' })
  city!: string;

  @ApiPropertyOptional({ example: 'Av. Heroínas 123', nullable: true })
  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'La dirección no puede superar 200 caracteres.' })
  address?: string | null;

  @ApiProperty({ example: '#6C4CF5' })
  @UppercaseHex()
  @IsString()
  @Matches(HEX_COLOR, { message: 'El color debe tener formato hexadecimal, por ejemplo #6C4CF5.' })
  primaryColor!: string;
}

/** Time zones offered for business days in reports (America/La_Paz by default). */
export const STORE_TIMEZONES = [
  'America/La_Paz',
  'America/Lima',
  'America/Bogota',
  'America/Guayaquil',
  'America/Caracas',
  'America/Santiago',
  'America/Asuncion',
  'America/Argentina/Buenos_Aires',
  'America/Montevideo',
  'America/Sao_Paulo',
  'America/Mexico_City',
] as const;

/** Full replacement of the editable fields (PUT /stores/current). */
export class UpdateStoreDto extends StoreFieldsDto {
  @ApiPropertyOptional({ enum: STORE_TIMEZONES, description: 'Zona horaria de la tienda (se conserva si se omite)' })
  @IsOptional()
  @IsIn(STORE_TIMEZONES, { message: 'Elige una zona horaria de la lista.' })
  timezone?: string;
}

export class StoreDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ nullable: true, type: String }) description!: string | null;
  @ApiProperty() whatsapp!: string;
  @ApiProperty() city!: string;
  @ApiProperty({ nullable: true, type: String }) address!: string | null;
  @ApiProperty() primaryColor!: string;
  @ApiProperty({ example: 'America/La_Paz' }) timezone!: string;
  @ApiProperty({ nullable: true, type: String, description: 'Pendiente hasta configurar almacenamiento de archivos' })
  logoUrl!: string | null;
  @ApiProperty() updatedAt!: Date;
}
