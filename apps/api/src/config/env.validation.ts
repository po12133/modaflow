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

const toBoolean =({ value }: { value: unknown }): unknown =>
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
