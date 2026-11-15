import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { SubscriptionExpiryService } from './subscription-expiry.service.js';

@Module({
  imports: [MailModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, SubscriptionExpiryService],
  exports: [NotificationsService, SubscriptionExpiryService],
})
export class NotificationsModule {}
