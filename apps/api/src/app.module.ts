import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AiModule } from './ai/ai.module.js';
import { coreImports } from './app-core.js';
import { AuthModule } from './auth/auth.module.js';
import { SessionGuard } from './auth/session.guard.js';
import { BillingModule } from './billing/billing.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { OriginGuard } from './common/origin.guard.js';
import { validateEnv } from './config/env.validation.js';
import { ImagesModule } from './images/images.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { OnboardingModule } from './onboarding/onboarding.module.js';
import { PlansModule } from './plans/plans.module.js';
import { ProductsModule } from './products/products.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { SalesModule } from './sales/sales.module.js';
import { StorefrontModule } from './storefront/storefront.module.js';
import { StoresModule } from './stores/stores.module.js';
import { SubscriptionsModule } from './subscriptions/subscriptions.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ...coreImports(validateEnv),
    AuthModule,
    UsersModule,
    PlansModule,
    SubscriptionsModule,
    StoresModule,
    OnboardingModule,
    CatalogModule,
    ImagesModule,
    ProductsModule,
    InventoryModule,
    AiModule,
    SalesModule,
    ReportsModule,
    StorefrontModule,
    NotificationsModule,
    BillingModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
})
export class AppModule {}
