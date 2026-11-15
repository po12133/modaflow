import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PaymentRequestsController } from './payment-requests.controller.js';
import { PaymentRequestsService } from './payment-requests.service.js';
import { PaymentReviewService } from './payment-review.service.js';
import { PlatformSettingsService } from './platform-settings.service.js';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service.js';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [PaymentRequestsController],
  providers: [PlatformSettingsService, SubscriptionLifecycleService, PaymentRequestsService, PaymentReviewService],
  exports: [PlatformSettingsService, SubscriptionLifecycleService, PaymentReviewService],
})
export class BillingModule {}
