import { Module } from '@nestjs/common';
import { NotificationsCoreModule } from '../notifications/notifications-core.module.js';
import { AdminAccountsController } from './admin-accounts.controller.js';
import { AdminBillingController } from './admin-billing.controller.js';
import { AdminDashboardService } from './admin-dashboard.service.js';
import { AdminOverviewController } from './admin-overview.controller.js';
import { AdminPlansService } from './admin-plans.service.js';
import { AdminStatsService } from './admin-stats.service.js';
import { AdminSubscriptionsService } from './admin-subscriptions.service.js';
import { AdminTenantsService } from './admin-tenants.service.js';
import { AdminUsersService } from './admin-users.service.js';
import { AuditModule } from './audit/audit.module.js';
import { AdminBillingModule } from './billing/admin-billing.module.js';
import { SubscriptionExpiryService } from './jobs/subscription-expiry.service.js';
import { StaffRolesGuard } from './staff-roles.guard.js';

@Module({
  imports: [AuditModule, AdminBillingModule, NotificationsCoreModule],
  controllers: [AdminOverviewController, AdminAccountsController, AdminBillingController],
  providers: [StaffRolesGuard, SubscriptionExpiryService, AdminDashboardService, AdminStatsService, AdminTenantsService, AdminUsersService, AdminPlansService, AdminSubscriptionsService],
})
export class AdminModule {}
