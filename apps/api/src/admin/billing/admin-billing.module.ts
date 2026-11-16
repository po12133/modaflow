import { Module } from '@nestjs/common';
import { NotificationsCoreModule } from '../../notifications/notifications-core.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { PaymentReviewService } from './payment-review.service.js';
import { PlanPaymentQrService } from './plan-payment-qr.service.js';
import { PlatformSettingsService } from './platform-settings.service.js';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service.js';

@Module({
  imports: [AuditModule, NotificationsCoreModule],
  providers: [PlatformSettingsService, SubscriptionLifecycleService, PaymentReviewService, PlanPaymentQrService],
  exports: [PlatformSettingsService, SubscriptionLifecycleService, PaymentReviewService, PlanPaymentQrService],
})
export class AdminBillingModule {}
