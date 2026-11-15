import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import { EnvironmentVariables } from '../config/env.validation.js';
import type { EmailConfig } from '../integrations/integration-config.js';
import { IntegrationConfigService } from '../integrations/integration-config.service.js';

export function smtpTransport(cfg: EmailConfig): Transporter {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    ...(cfg.user ? { auth: { user: cfg.user, pass: cfg.password ?? '' } } : {}),
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

export const fromHeader = (cfg: EmailConfig) => ({ name: cfg.fromName, address: cfg.fromEmail });

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly isProduction: boolean;
  private cached: { key: string; transport: Transporter } | null = null;

  constructor(
    private readonly integrations: IntegrationConfigService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.isProduction = config.get('NODE_ENV', { infer: true }) === 'production';
  }

  isConfigured(): boolean {
    return this.integrations.snapshot().email !== null;
  }

  async sendPasswordReset(to: { userId: string; email: string; name: string }, resetUrl: string): Promise<void> {
    const sent = await this.send([to.email], 'Recupera tu contraseña de ModaFlow', `Hola ${to.name}:\n\nPara elegir una contraseña nueva abre este enlace (vence en 60 minutos):\n${resetUrl}\n\nSi no lo pediste, ignora este correo.`);
    if (sent) return;
    if (this.isProduction) this.logger.warn(`Email delivery not configured; password reset for user ${to.userId} was not sent.`);
    else this.logger.warn(`[DEV] Email delivery not configured. Password reset for ${to.email}: ${resetUrl}`);
  }

  async sendNotification(recipients: string[], subject: string, body: string): Promise<'SENT' | 'SKIPPED'> {
    if (recipients.length === 0) return 'SKIPPED';
    return (await this.send(recipients, subject, body)) ? 'SENT' : 'SKIPPED';
  }

  private async send(recipients: string[], subject: string, text: string): Promise<boolean> {
    const cfg = (await this.integrations.fresh()).email;
    if (!cfg) return false;
    await this.transport(cfg).sendMail({ from: fromHeader(cfg), to: fromHeader(cfg), bcc: recipients, subject, text });
    return true;
  }

  private transport(cfg: EmailConfig): Transporter {
    const key = JSON.stringify(cfg);
    if (this.cached?.key !== key) {
      this.cached?.transport.close();
      this.cached = { key, transport: smtpTransport(cfg) };
    }
    return this.cached.transport;
  }
}
