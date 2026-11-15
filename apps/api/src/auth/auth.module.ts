import { Global, Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';

@Global()
@Module({
  imports: [MailModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, SessionService],
  exports: [PasswordService, SessionService],
})
export class AuthModule {}
