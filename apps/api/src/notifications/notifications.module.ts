import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsCoreModule } from './notifications-core.module.js';

@Module({
  imports: [NotificationsCoreModule],
  controllers: [NotificationsController],
})
export class NotificationsModule {}
