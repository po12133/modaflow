import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [MailModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsCoreModule {}
