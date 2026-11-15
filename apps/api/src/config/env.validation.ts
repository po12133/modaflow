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
import { IntegrationEnvironmentVariables, toBoolean } from './integration-env.js';

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

export class EnvironmentVariables extends IntegrationEnvironmentVariables {
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
}

/** Builds a validator for process.env; the process refuses to boot on invalid config. */
export function createEnvValidator<T extends object>(schema: new () => T) {
  return (config: Record<string, unknown>): T => {
    const validated = plainToInstance(schema, config, { enableImplicitConversion: true, excludeExtraneousValues: false });
    const errors = validateSync(validated, { skipMissingProperties: false });
    if (errors.length > 0) {
      const details = errors.map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`).join('; ');
      throw new Error(`Invalid environment configuration -> ${details}`);
    }
    return validated;
  };
}

export const validateEnv = createEnvValidator(EnvironmentVariables);
