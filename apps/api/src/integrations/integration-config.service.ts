import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { decryptSecret, encryptSecret, isEncryptionKey } from '../common/secret-box.js';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { type IntegrationEnv, type IntegrationRow, type ResolvedIntegrations, resolveIntegrations } from './integration-config.js';

const TTL_MS = 15_000;
const ENV_KEYS = [
  'S3_ENDPOINT', 'S3_PUBLIC_ENDPOINT', 'S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_FORCE_PATH_STYLE',
  'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL',
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM_EMAIL', 'SMTP_FROM_NAME',
] as const;

@Injectable()
export class IntegrationConfigService implements OnModuleInit {
  private readonly logger = new Logger(IntegrationConfigService.name);
  readonly env: IntegrationEnv;
  private readonly key: string | undefined;
  private row: IntegrationRow | null = null;
  private current: ResolvedIntegrations;
  private loadedAt = 0;
  private loading: Promise<void> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.env = Object.fromEntries(ENV_KEYS.map((k) => [k, config.get(k, { infer: true }) || undefined])) as IntegrationEnv;
    const key = config.get('SETTINGS_ENCRYPTION_KEY', { infer: true });
    this.key = isEncryptionKey(key) ? key : undefined;
    this.current = resolveIntegrations(null, this.env, () => null);
  }

  async onModuleInit(): Promise<void> {
    await this.refresh();
  }

  snapshot(): ResolvedIntegrations {
    if (Date.now() - this.loadedAt > TTL_MS) void this.refresh();
    return this.current;
  }

  async fresh(): Promise<ResolvedIntegrations> {
    if (Date.now() - this.loadedAt > TTL_MS) await this.refresh();
    return this.current;
  }

  storedRow(): IntegrationRow | null {
    return this.row;
  }

  refresh(): Promise<void> {
    this.loading ??= this.load().finally(() => {
      this.loadedAt = Date.now();
      this.loading = null;
    });
    return this.loading;
  }

  get canEncrypt(): boolean {
    return this.key !== undefined;
  }

  encrypt(plain: string): string {
    if (!this.key) throw new Error('SETTINGS_ENCRYPTION_KEY is not configured');
    return encryptSecret(plain, this.key);
  }

  decrypt(blob: string): string | null {
    if (!this.key) return null;
    try {
      return decryptSecret(blob, this.key);
    } catch {
      this.logger.error('A secret saved from the admin panel cannot be decrypted (was SETTINGS_ENCRYPTION_KEY changed?).');
      return null;
    }
  }

  resolve(row: IntegrationRow | null, decrypt: (blob: string) => string | null = (b) => this.decrypt(b)): ResolvedIntegrations {
    return resolveIntegrations(row, this.env, decrypt);
  }

  private async load(): Promise<void> {
    try {
      const found = await this.prisma.integrationSettings.findUnique({ where: { id: 1 } });
      this.row = found;
      this.current = this.resolve(found);
    } catch (error) {
      this.logger.warn(`Could not load integration settings, using environment variables: ${String(error)}`);
    }
  }
}
