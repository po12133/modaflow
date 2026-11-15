import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, IsUrl, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { Trim } from '../../common/validation.js';

const URL_OPTIONS = { require_tld: false, protocols: ['http', 'https'], require_protocol: true };
const SECRET = 'Valor nuevo (se guarda cifrado y nunca se vuelve a mostrar). null = quitarlo del panel y usar la variable de entorno.';
const PLAIN = 'null = usar la variable de entorno.';

export class ReauthDto {
  @ApiProperty({ description: 'Contraseña actual del miembro del equipo (confirmación para cambios sensibles)' }) @IsString() @Length(1, 128) currentPassword!: string;
}

export class StorageIntegrationDto extends ReauthDto {
  @ApiPropertyOptional({ nullable: true, description: PLAIN }) @IsOptional() @Trim() @IsUrl(URL_OPTIONS) @MaxLength(300) s3Endpoint?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Trim() @IsUrl(URL_OPTIONS) @MaxLength(300) s3PublicEndpoint?: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'auto' }) @IsOptional() @Trim() @Matches(/^[a-z0-9-]{2,40}$/) s3Region?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Trim() @Matches(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, { message: 'Nombre de bucket no válido (minúsculas, números, puntos y guiones).' }) s3Bucket?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsBoolean() s3ForcePathStyle?: boolean | null;
  @ApiPropertyOptional({ nullable: true, description: SECRET }) @IsOptional() @IsString() @Length(4, 200) s3AccessKeyId?: string | null;
  @ApiPropertyOptional({ nullable: true, description: SECRET }) @IsOptional() @IsString() @Length(8, 300) s3SecretAccessKey?: string | null;
}

export class AiIntegrationDto extends ReauthDto {
  @ApiPropertyOptional({ nullable: true, example: 'claude-opus-5-5' }) @IsOptional() @Trim() @Matches(/^[a-z0-9.-]{3,80}$/) anthropicModel?: string | null;
  @ApiPropertyOptional({ nullable: true, description: SECRET }) @IsOptional() @IsString() @Length(20, 300) anthropicApiKey?: string | null;
}

export class EmailIntegrationDto extends ReauthDto {
  @ApiPropertyOptional({ nullable: true, example: 'smtp.gmail.com' }) @IsOptional() @Trim() @Matches(/^[A-Za-z0-9.-]{1,200}$/, { message: 'Servidor SMTP no válido.' }) smtpHost?: string | null;
  @ApiPropertyOptional({ nullable: true, example: 587 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) smtpPort?: number | null;
  @ApiPropertyOptional({ nullable: true, description: 'true = TLS directo (465); false = STARTTLS (587)' }) @IsOptional() @IsBoolean() smtpSecure?: boolean | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Trim() @IsString() @MaxLength(200) smtpUser?: string | null;
  @ApiPropertyOptional({ nullable: true, description: SECRET }) @IsOptional() @IsString() @Length(1, 300) smtpPassword?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Trim() @IsEmail({}, { message: 'Ingresa un correo válido.' }) @MaxLength(254) smtpFromEmail?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Trim() @IsString() @Length(1, 80) smtpFromName?: string | null;
}

export type SectionDto = StorageIntegrationDto | AiIntegrationDto | EmailIntegrationDto;
