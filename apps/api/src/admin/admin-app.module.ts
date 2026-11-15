import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard } from '@nestjs/throttler';
import { coreImports } from '../app-core.js';
import { OriginGuard } from '../common/origin.guard.js';
import { validateAdminEnv } from './admin-env.js';
import { AdminModule } from './admin.module.js';
import { StaffAuthModule } from './auth/staff-auth.module.js';
import { StaffSessionGuard } from './auth/staff-session.guard.js';

@Module({
  imports: [...coreImports(validateAdminEnv), ScheduleModule.forRoot(), StaffAuthModule, AdminModule],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: StaffSessionGuard },
  ],
})
export class AdminAppModule {}
