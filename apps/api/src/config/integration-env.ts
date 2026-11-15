import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

/** Compose passes unset optional variables as "" — treat them as missing. */
export const emptyToUndefined = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export const toBoolean = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() === 'true' : value;

/** Defaults for S3, Claude and SMTP. Values saved in the admin panel take precedence. */
export class IntegrationEnvironmentVariables {
  // ---- Claude API (garment recognition). Without a key, AI analysis is disabled. ----

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  ANTHROPIC_API_KEY?: string;

  /** Vision-capable Claude model id. */
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @Matches(/^[a-z0-9.-]+$/)
  ANTHROPIC_MODEL: string = 'claude-opus-5-5';

  /** Max time for one analysis request to Claude (ms). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5_000)
  @Max(180_000)
  AI_TIMEOUT_MS: number = 60_000;

  // ---- S3-compatible storage (product photos). Without it, photo upload is disabled. ----

  /** Endpoint the API uses (e.g. https://<account>.r2.cloudflarestorage.com, http://minio:9000). Empty = AWS S3. */
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  S3_ENDPOINT?: string;

  /**
   * Endpoint used in signed URLs given to browsers, when it differs from
   * S3_ENDPOINT (e.g. http://localhost:9000 in Docker development).
   */
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  S3_PUBLIC_ENDPOINT?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  S3_REGION: string = 'us-east-1';

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  S3_BUCKET?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  S3_ACCESS_KEY_ID?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  S3_SECRET_ACCESS_KEY?: string;

  /** Path-style URLs (required by MinIO and most self-hosted S3). */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  S3_FORCE_PATH_STYLE: boolean = true;

  /** Development only: create S3_BUCKET at startup if it does not exist. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  S3_AUTO_CREATE_BUCKET: boolean = false;

  /** Lifetime of signed photo URLs (seconds). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(86_400)
  S3_SIGNED_URL_TTL_SECONDS: number = 3_600;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  SMTP_HOST?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  SMTP_PORT: number = 587;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  SMTP_SECURE: boolean = false;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  SMTP_PASSWORD?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  SMTP_FROM_EMAIL?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  SMTP_FROM_NAME: string = 'ModaFlow';

  /** 64 hex characters (openssl rand -hex 32). Encrypts the secrets saved from the admin panel. */
  @IsOptional()
  @Transform(emptyToUndefined)
  @Matches(/^[0-9a-fA-F]{64}$/, { message: 'SETTINGS_ENCRYPTION_KEY must be 64 hex characters (openssl rand -hex 32)' })
  SETTINGS_ENCRYPTION_KEY?: string;
}
