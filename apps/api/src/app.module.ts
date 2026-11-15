import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Local runs (outside Docker) read apps/api/.env or the monorepo root .env.
      // In containers, variables come from the environment.
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
    }),
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
