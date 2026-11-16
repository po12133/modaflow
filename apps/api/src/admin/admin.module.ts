import { Module } from '@nestjs/common';
import { NotificationsCoreModule } from '../notifications/notifications-core.module.js';
import { AdminAccountsController } from './admin-accounts.controller.js';
import { AdminBillingController } from './admin-billing.controller.js';
import { AdminPaymentQrController } from './admin-payment-qr.controller.js';
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
import { AdminIntegrationsController } from './integrations/admin-integrations.controller.js';
import { AdminIntegrationsService } from './integrations/admin-integrations.service.js';
import { PasswordService } from '../auth/password.service.js';
import { AdminStaffController } from './staff/admin-staff.controller.js';
import { AdminStaffService } from './staff/admin-staff.service.js';

import { AdminConsumptionController } from './consumption/admin-consumption.controller.js';
import { AdminConsumptionService } from './consumption/admin-consumption.service.js';
@Module({
  imports: [AuditModule, AdminBillingModule, NotificationsCoreModule],
  controllers: [AdminConsumptionController, AdminOverviewController, AdminAccountsController, AdminBillingController, AdminPaymentQrController, AdminStaffController, AdminIntegrationsController],
  providers: [AdminConsumptionService, StaffRolesGuard, SubscriptionExpiryService, AdminDashboardService, AdminStatsService, AdminTenantsService, AdminUsersService, AdminPlansService, AdminSubscriptionsService, AdminStaffService, AdminIntegrationsService, PasswordService],
})
export class AdminModule {}
