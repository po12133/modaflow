import { Module } from '@nestjs/common';
import { PasswordService } from '../../auth/password.service.js';
import { AuditModule } from '../audit/audit.module.js';
import { StaffAuthController } from './staff-auth.controller.js';
import { StaffAuthService } from './staff-auth.service.js';
import { StaffSessionService } from './staff-session.service.js';

@Module({
  imports: [AuditModule],
  controllers: [StaffAuthController],
  providers: [PasswordService, StaffSessionService, StaffAuthService],
  exports: [StaffSessionService],
})
export class StaffAuthModule {}
