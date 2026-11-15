import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/env.validation.js';

/**
 * Outgoing email. SMTP is not configured yet, so messages are not delivered:
 * in development the password-reset link is logged so the flow can be tested;
 * in production only a notice is logged (never the link or token).
 * Replace `deliver` with a real transport once SMTP credentials exist.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly isProduction: boolean;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.isProduction = config.get('NODE_ENV', { infer: true }) === 'production';
  }

  async sendPasswordReset(to: { userId: string; email: string; name: string }, resetUrl: string): Promise<void> {
    await this.deliver(to.userId, () => `Recuperación de contraseña para ${to.email}: ${resetUrl}`);
  }

  isConfigured(): boolean {
    return false;
  }

  async sendNotification(recipients: string[], subject: string): Promise<'SENT' | 'SKIPPED'> {
    if (!this.isConfigured() || recipients.length === 0) {
      this.logger.debug(`Notification email skipped (SMTP pending): ${subject}`);
      return 'SKIPPED';
    }
    return Promise.resolve('SENT');
  }

  private deliver(userId: string, devPreview: () => string): Promise<void> {
    if (this.isProduction) {
      this.logger.warn(`Email delivery not configured (SMTP pending); message for user ${userId} was not sent.`);
    } else {
      this.logger.warn(`[DEV] Email delivery not configured. ${devPreview()}`);
    }
    return Promise.resolve();
  }
}
