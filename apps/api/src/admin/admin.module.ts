import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { BillingModule } from '../billing/billing.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AdminAccountsController } from './admin-accounts.controller.js';
import { AdminBillingController } from './admin-billing.controller.js';
import { AdminDashboardService } from './admin-dashboard.service.js';
import { AdminOverviewController } from './admin-overview.controller.js';
import { AdminPlansService } from './admin-plans.service.js';
import { AdminStatsService } from './admin-stats.service.js';
import { AdminSubscriptionsService } from './admin-subscriptions.service.js';
import { AdminTenantsService } from './admin-tenants.service.js';
import { AdminUsersService } from './admin-users.service.js';
import { GlobalRolesGuard } from './global-roles.guard.js';

@Module({
  imports: [AuditModule, BillingModule, NotificationsModule],
  controllers: [AdminOverviewController, AdminAccountsController, AdminBillingController],
  providers: [GlobalRolesGuard, AdminDashboardService, AdminStatsService, AdminTenantsService, AdminUsersService, AdminPlansService, AdminSubscriptionsService],
})
export class AdminModule {}
