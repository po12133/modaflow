import type { IntegrationSettings } from '../generated/prisma/client.js';

export type IntegrationSection = 'storage' | 'ai' | 'email';
export const INTEGRATION_SECTIONS: IntegrationSection[] = ['storage', 'ai', 'email'];

export interface StorageConfig {
  endpoint?: string;
  publicEndpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  keyPrefix: string;
  publicUrls: boolean;
}

export interface AiConfig {
  apiKey: string;
  model: string;
}

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  fromEmail: string;
  fromName: string;
}

export interface ResolvedIntegrations {
  storage: StorageConfig | null;
  ai: AiConfig | null;
  email: EmailConfig | null;
}

export interface IntegrationEnv {
  S3_ENDPOINT?: string;
  S3_PUBLIC_ENDPOINT?: string;
  S3_REGION?: string;
  S3_BUCKET?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_FORCE_PATH_STYLE?: boolean;
  S3_KEY_PREFIX?: string;
  S3_PUBLIC_URLS?: boolean;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_SECURE?: boolean;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  SMTP_FROM_EMAIL?: string;
  SMTP_FROM_NAME?: string;
}

export type IntegrationRow = Omit<IntegrationSettings, 'id' | 'updatedById' | 'updatedAt'>;

export const DEFAULT_AI_MODEL = 'claude-opus-5-5';

export function isLocalEndpoint(endpoint: string | undefined): boolean {
  if (!endpoint) return false;
  try {
    const host = new URL(endpoint).hostname;
    return !host.includes('.') || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[');
  } catch {
    return false;
  }
}

export function withoutBucketHost(endpoint: string | undefined, bucket: string): string | undefined {
  if (!endpoint) return endpoint;
  try {
    const url = new URL(endpoint);
    if (!url.hostname.startsWith(`${bucket}.`)) return endpoint;
    url.hostname = url.hostname.slice(bucket.length + 1);
    return url.toString().replace(/\/$/, '');
  } catch {
    return endpoint;
  }
}

export function normalizeKeyPrefix(prefix: string | undefined): string {
  const clean = (prefix ?? '').trim().replace(/^\/+|\/+$/g, '');
  return clean ? `${clean}/` : '';
}

export interface ModelOption {
  value: string;
  label: string;
}

export const AI_MODEL_OPTIONS: ModelOption[] = [
  { value: 'claude-opus-5-5', label: 'Claude Opus 5.5 · máxima precisión (recomendado)' },
  { value: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 · equilibrio entre precisión y costo' },
  { value: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 · el más rápido y económico' },
  { value: 'claude-fable-5-2', label: 'Claude Fable 5.2' },
];

const pick = <T>(panel: T | null | undefined, env: T | undefined): T | undefined => (panel !== null && panel !== undefined && panel !== '' ? panel : env || undefined);

export function resolveIntegrations(row: IntegrationRow | null, env: IntegrationEnv, decrypt: (blob: string) => string | null): ResolvedIntegrations {
  const secret = (blob: string | null | undefined, fallback: string | undefined) => (blob ? (decrypt(blob) ?? undefined) : fallback || undefined);

  const bucket = pick(row?.s3Bucket, env.S3_BUCKET);
  const accessKeyId = secret(row?.s3AccessKeyIdEnc, env.S3_ACCESS_KEY_ID);
  const secretAccessKey = secret(row?.s3SecretAccessKeyEnc, env.S3_SECRET_ACCESS_KEY);
  const storage: StorageConfig | null =
    bucket && accessKeyId && secretAccessKey
      ? {
          endpoint: withoutBucketHost(pick(row?.s3Endpoint, env.S3_ENDPOINT), bucket),
          publicEndpoint: withoutBucketHost(pick(row?.s3PublicEndpoint, env.S3_PUBLIC_ENDPOINT), bucket),
          region: pick(row?.s3Region, env.S3_REGION) ?? 'us-east-1',
          bucket,
          accessKeyId,
          secretAccessKey,
          forcePathStyle: env.S3_FORCE_PATH_STYLE ?? isLocalEndpoint(pick(row?.s3Endpoint, env.S3_ENDPOINT)),
          keyPrefix: normalizeKeyPrefix(pick(row?.s3KeyPrefix, env.S3_KEY_PREFIX)),
          publicUrls: row?.s3PublicUrls ?? env.S3_PUBLIC_URLS ?? false,
        }
      : null;

  const apiKey = secret(row?.anthropicApiKeyEnc, env.ANTHROPIC_API_KEY);
  const ai: AiConfig | null = apiKey ? { apiKey, model: pick(row?.anthropicModel, env.ANTHROPIC_MODEL) ?? DEFAULT_AI_MODEL } : null;

  const host = pick(row?.smtpHost, env.SMTP_HOST);
  const fromEmail = pick(row?.smtpFromEmail, env.SMTP_FROM_EMAIL);
  const email: EmailConfig | null =
    host && fromEmail
      ? {
          host,
          port: row?.smtpPort ?? env.SMTP_PORT ?? 587,
          secure: row?.smtpSecure ?? env.SMTP_SECURE ?? false,
          user: pick(row?.smtpUser, env.SMTP_USER),
          password: secret(row?.smtpPasswordEnc, env.SMTP_PASSWORD),
          fromEmail,
          fromName: pick(row?.smtpFromName, env.SMTP_FROM_NAME) ?? 'ModaFlow',
        }
      : null;

  return { storage, ai, email };
}
