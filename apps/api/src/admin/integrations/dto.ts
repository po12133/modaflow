import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUrl, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { Trim } from '../../common/validation.js';
import { AI_MODEL_OPTIONS } from '../../integrations/integration-config.js';

const AI_MODELS = AI_MODEL_OPTIONS.map((m) => m.value);

const URL_OPTIONS = { require_tld: false, protocols: ['http', 'https'], require_protocol: true };
const SECRET = 'Valor nuevo (se guarda cifrado y nunca se vuelve a mostrar). null = quitarlo del panel y usar la variable de entorno.';
const PLAIN = 'null = usar la variable de entorno.';

export class ReauthDto {
  @ApiProperty({ description: 'Contraseña actual del miembro del equipo (confirmación para cambios sensibles)' }) @IsString() @Length(1, 128) currentPassword!: string;
}

export class StorageIntegrationDto extends ReauthDto {
  @ApiPropertyOptional({ nullable: true, description: PLAIN }) @IsOptional() @Trim() @IsUrl(URL_OPTIONS, { message: 'Endpoint no válido: usa una URL completa, por ejemplo https://s3.amazonaws.com.' }) @MaxLength(300) s3Endpoint?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Trim() @IsUrl(URL_OPTIONS, { message: 'Endpoint público no válido: usa una URL completa.' }) @MaxLength(300) s3PublicEndpoint?: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'auto' }) @IsOptional() @Trim() @Matches(/^[a-z0-9-]{2,40}$/, { message: 'Región no válida (por ejemplo us-east-1 o auto).' }) s3Region?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Trim() @Matches(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, { message: 'Nombre de bucket no válido (minúsculas, números, puntos y guiones).' }) s3Bucket?: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'modaflow', description: 'Carpeta dentro del bucket. ' + PLAIN })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/^\/+|\/+$/g, '') || null : value))
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/, { message: 'Carpeta no válida: usa letras, números, guiones, puntos y "/" (por ejemplo modaflow o clientes/modaflow).' })
  @MaxLength(120)
  s3KeyPrefix?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'true = bucket público: URLs directas sin firma (los comprobantes de pago siguen firmados). ' + PLAIN }) @IsOptional() @IsBoolean() s3PublicUrls?: boolean | null;
  @ApiPropertyOptional({ nullable: true, description: SECRET }) @IsOptional() @IsString() @Length(4, 200, { message: 'Access key ID no válido.' }) s3AccessKeyId?: string | null;
  @ApiPropertyOptional({ nullable: true, description: SECRET }) @IsOptional() @IsString() @Length(8, 300, { message: 'Secret access key no válido.' }) s3SecretAccessKey?: string | null;
}

export class AiIntegrationDto extends ReauthDto {
  @ApiPropertyOptional({ nullable: true, enum: AI_MODELS }) @IsOptional() @IsIn(AI_MODELS, { message: 'Elige uno de los modelos de la lista.' }) anthropicModel?: string | null;
  @ApiPropertyOptional({ nullable: true, description: SECRET }) @IsOptional() @IsString() @Length(20, 300, { message: 'La llave de la API no parece válida (debe empezar con sk-ant-).' }) anthropicApiKey?: string | null;
}

export class EmailIntegrationDto extends ReauthDto {
  @ApiPropertyOptional({ nullable: true, example: 'smtp.gmail.com' }) @IsOptional() @Trim() @Matches(/^[A-Za-z0-9.-]{1,200}$/, { message: 'Servidor SMTP no válido.' }) smtpHost?: string | null;
  @ApiPropertyOptional({ nullable: true, example: 587 }) @IsOptional() @Type(() => Number) @IsInt({ message: 'Puerto no válido.' }) @Min(1, { message: 'Puerto no válido.' }) @Max(65535, { message: 'Puerto no válido.' }) smtpPort?: number | null;
  @ApiPropertyOptional({ nullable: true, description: 'true = TLS directo (465); false = STARTTLS (587)' }) @IsOptional() @IsBoolean() smtpSecure?: boolean | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Trim() @IsString() @MaxLength(200) smtpUser?: string | null;
  @ApiPropertyOptional({ nullable: true, description: SECRET }) @IsOptional() @IsString() @Length(1, 300) smtpPassword?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Trim() @IsEmail({}, { message: 'Ingresa un correo válido.' }) @MaxLength(254) smtpFromEmail?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Trim() @IsString() @Length(1, 80, { message: 'El nombre del remitente debe tener hasta 80 caracteres.' }) smtpFromName?: string | null;
}

export type SectionDto = StorageIntegrationDto | AiIntegrationDto | EmailIntegrationDto;
