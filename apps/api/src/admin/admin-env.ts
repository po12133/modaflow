import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { createEnvValidator, EnvironmentVariables } from '../config/env.validation.js';

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
}

export const validateAdminEnv = createEnvValidator(AdminEnvironmentVariables);
