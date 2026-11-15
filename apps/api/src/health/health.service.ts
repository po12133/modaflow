import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/env.validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthResponseDto } from './health.dto.js';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async check(): Promise<HealthResponseDto> {
    const started = performance.now();
    let dbUp = true;
    try {
      await this.prisma.ping();
    } catch (error) {
      dbUp = false;
      this.logger.error(`Database health probe failed: ${(error as Error).message}`);
    }

    return {
      status: dbUp ? 'ok' : 'error',
      service: 'modaflow-api',
      environment: this.config.get('APP_ENV', { infer: true }),
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      database: {
        status: dbUp ? 'up' : 'down',
        latencyMs: Math.round(performance.now() - started),
      },
    };
  }
}
