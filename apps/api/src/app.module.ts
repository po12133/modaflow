import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AiModule } from './ai/ai.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { SessionGuard } from './auth/session.guard.js';
import { OriginGuard } from './common/origin.guard.js';
import { validateEnv } from './config/env.validation.js';
import { HealthModule } from './health/health.module.js';
import { ImagesModule } from './images/images.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { OnboardingModule } from './onboarding/onboarding.module.js';
import { PlansModule } from './plans/plans.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProductsModule } from './products/products.module.js';
import { StorageModule } from './storage/storage.module.js';
import { StoresModule } from './stores/stores.module.js';
import { SubscriptionsModule } from './subscriptions/subscriptions.module.js';
import { UsersModule } from './users/users.module.js';

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
    // Default per-IP rate limit; credential endpoints override it with @Throttle().
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
      errorMessage: 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.',
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    PlansModule,
    SubscriptionsModule,
    StoresModule,
    OnboardingModule,
    // Stage 2
    StorageModule,
    CatalogModule,
    ImagesModule,
    ProductsModule,
    InventoryModule,
    AiModule,
  ],
  providers: [
    // Global guards run in this order: rate limit -> CSRF origin check -> session.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
})
export class AppModule {}
