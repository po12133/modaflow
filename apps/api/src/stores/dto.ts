import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
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

/** Full replacement of the editable fields (PUT /stores/current). */
export class UpdateStoreDto extends StoreFieldsDto {}

export class StoreDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ nullable: true, type: String }) description!: string | null;
  @ApiProperty() whatsapp!: string;
  @ApiProperty() city!: string;
  @ApiProperty({ nullable: true, type: String }) address!: string | null;
  @ApiProperty() primaryColor!: string;
  @ApiProperty({ nullable: true, type: String, description: 'Pendiente hasta configurar almacenamiento de archivos' })
  logoUrl!: string | null;
  @ApiProperty() updatedAt!: Date;
}
