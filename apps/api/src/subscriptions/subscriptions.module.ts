import { Global, Module } from '@nestjs/common';
import { EntitlementsService } from './entitlements.service.js';
import { SubscriptionGuard } from './subscription.guard.js';
import { SubscriptionsController } from './subscriptions.controller.js';

/** Global so any future module can inject EntitlementsService / use @RequireFeature(). */
@Global()
@Module({
  controllers: [SubscriptionsController],
  providers: [EntitlementsService, SubscriptionGuard],
  exports: [EntitlementsService, SubscriptionGuard],
})
export class SubscriptionsModule {}
