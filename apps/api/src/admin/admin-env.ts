import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min, MinLength } from 'class-validator';
import { createEnvValidator, EnvironmentVariables } from '../config/env.validation.js';

const emptyAsUnset = () => Transform(({ value }: { value: unknown }) => (value === '' ? undefined : value));

export class AdminEnvironmentVariables extends EnvironmentVariables {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  ADMIN_SESSION_TTL_HOURS: number = 8;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(1440)
  ADMIN_SESSION_IDLE_MINUTES: number = 60;

  @IsOptional()
  @Matches(/^https?:\/\/[^\s/]+$/, { message: 'ADMIN_WEB_URL must be an origin like https://admin.example.com' })
  ADMIN_WEB_URL: string = 'http://localhost:3002';

  @emptyAsUnset()
  @IsOptional()
  @IsString()
  @MinLength(16, { message: 'BACKUP_DB_PASSWORD must have at least 16 characters' })
  BACKUP_DB_PASSWORD?: string;

  @emptyAsUnset()
  @IsOptional()
  @Matches(/^[0-9a-fA-F]{64}$/, { message: 'BACKUP_ENCRYPTION_KEY must be 64 hex characters (openssl rand -hex 32)' })
  BACKUP_ENCRYPTION_KEY?: string;
}

export const validateAdminEnv = createEnvValidator(AdminEnvironmentVariables);
