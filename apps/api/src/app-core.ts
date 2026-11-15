import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { HealthModule } from './health/health.module.js';
import { IntegrationsModule } from './integrations/integrations.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { StorageModule } from './storage/storage.module.js';

export function coreImports(validate: (config: Record<string, unknown>) => object) {
  return [
    ConfigModule.forRoot({ isGlobal: true, cache: true, envFilePath: ['.env', '../../.env'], validate }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
      errorMessage: 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.',
    }),
    PrismaModule,
    IntegrationsModule,
    HealthModule,
    StorageModule,
  ];
}
