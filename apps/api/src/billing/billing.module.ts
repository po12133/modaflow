import { Module } from '@nestjs/common';
import { NotificationsCoreModule } from '../notifications/notifications-core.module.js';
import { PaymentInfoService } from './payment-info.service.js';
import { PaymentRequestsController } from './payment-requests.controller.js';
import { PaymentRequestsService } from './payment-requests.service.js';

@Module({
  imports: [NotificationsCoreModule],
  controllers: [PaymentRequestsController],
  providers: [PaymentInfoService, PaymentRequestsService],
})
export class BillingModule {}
