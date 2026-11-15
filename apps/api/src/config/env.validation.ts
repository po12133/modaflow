import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export enum AppEnv {
  Development = 'development',
  Staging = 'staging',
  Production = 'production',
}

/** Compose passes unset optional variables as "" — treat them as missing. */
const emptyToUndefined = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const toBoolean = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() === 'true' : value;

export class EnvironmentVariables {
  @IsOptional()
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  /** Deployment environment name (staging runs with NODE_ENV=production). */
  @IsOptional()
  @IsEnum(AppEnv)
  APP_ENV: AppEnv = AppEnv.Development;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3001;

  @IsString()
  @IsNotEmpty()
  @Matches(/^postgres(ql)?:\/\//, {
    message: 'DATABASE_URL must be a postgresql:// connection string',
  })
  DATABASE_URL!: string;

  /** Comma-separated list of allowed origins, or "*" to allow any origin. */
  @IsOptional()
  @IsString()
  CORS_ORIGINS: string = 'http://localhost:3000';

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  SWAGGER_ENABLED: boolean = true;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9/_-]+$/)
  SWAGGER_PATH: string = 'docs';

  /** Absolute lifetime of a login session, in days. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  SESSION_TTL_DAYS: number = 30;

  /** Secure flag for the session cookie. Defaults to true when NODE_ENV=production. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  COOKIE_SECURE?: boolean;

  /**
   * Express "trust proxy" value, so req.ip is the real client behind Coolify's
   * proxy and the Next.js server. Private ranges only by default.
   */
  @IsOptional()
  @IsString()
  TRUST_PROXY: string = 'loopback, linklocal, uniquelocal';

  /** Public URL of the web app, used to build links sent to users (password reset). */
  @IsOptional()
  @Matches(/^https?:\/\/[^\s/]+$/, { message: 'WEB_APP_URL must be an origin like https://example.com' })
  WEB_APP_URL: string = 'http://localhost:3000';

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
}

/** Validates process.env at startup; the app refuses to boot on invalid config. */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
    excludeExtraneousValues: false,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors
      .map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('; ');
    throw new Error(`Invalid environment configuration -> ${details}`);
  }
  return validated;
}
