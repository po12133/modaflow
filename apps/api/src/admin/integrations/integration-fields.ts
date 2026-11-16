import { AI_MODEL_OPTIONS, type IntegrationEnv, type IntegrationRow, type IntegrationSection, type ModelOption } from '../../integrations/integration-config.js';

type RowKey = keyof IntegrationRow;
type EnvKey = keyof IntegrationEnv;

export interface SecretField {
  enc: RowKey;
  hint: RowKey;
  env: EnvKey;
}

export interface SectionFields {
  plain: Record<string, { column: RowKey; env: EnvKey; options?: ModelOption[] }>;
  secrets: Record<string, SecretField>;
}

export const SECTION_FIELDS: Record<IntegrationSection, SectionFields> = {
  storage: {
    plain: {
      s3Endpoint: { column: 's3Endpoint', env: 'S3_ENDPOINT' },
      s3PublicEndpoint: { column: 's3PublicEndpoint', env: 'S3_PUBLIC_ENDPOINT' },
      s3Region: { column: 's3Region', env: 'S3_REGION' },
      s3Bucket: { column: 's3Bucket', env: 'S3_BUCKET' },
      s3KeyPrefix: { column: 's3KeyPrefix', env: 'S3_KEY_PREFIX' },
      s3PublicUrls: { column: 's3PublicUrls', env: 'S3_PUBLIC_URLS' },
    },
    secrets: {
      s3AccessKeyId: { enc: 's3AccessKeyIdEnc', hint: 's3AccessKeyIdHint', env: 'S3_ACCESS_KEY_ID' },
      s3SecretAccessKey: { enc: 's3SecretAccessKeyEnc', hint: 's3SecretAccessKeyHint', env: 'S3_SECRET_ACCESS_KEY' },
    },
  },
  ai: {
    plain: { anthropicModel: { column: 'anthropicModel', env: 'ANTHROPIC_MODEL', options: AI_MODEL_OPTIONS } },
    secrets: { anthropicApiKey: { enc: 'anthropicApiKeyEnc', hint: 'anthropicApiKeyHint', env: 'ANTHROPIC_API_KEY' } },
  },
  email: {
    plain: {
      smtpHost: { column: 'smtpHost', env: 'SMTP_HOST' },
      smtpPort: { column: 'smtpPort', env: 'SMTP_PORT' },
      smtpSecure: { column: 'smtpSecure', env: 'SMTP_SECURE' },
      smtpUser: { column: 'smtpUser', env: 'SMTP_USER' },
      smtpFromEmail: { column: 'smtpFromEmail', env: 'SMTP_FROM_EMAIL' },
      smtpFromName: { column: 'smtpFromName', env: 'SMTP_FROM_NAME' },
    },
    secrets: { smtpPassword: { enc: 'smtpPasswordEnc', hint: 'smtpPasswordHint', env: 'SMTP_PASSWORD' } },
  },
};

export type FieldSource = 'panel' | 'env' | 'none';
type Plain = string | number | boolean | null;

export function describeSection(section: IntegrationSection, row: IntegrationRow | null, env: IntegrationEnv, readable: (blob: string) => boolean) {
  const { plain, secrets } = SECTION_FIELDS[section];
  const fields = Object.fromEntries(
    Object.entries(plain).map(([name, f]) => {
      const value = (row?.[f.column] ?? null) as Plain;
      const envValue = (env[f.env] ?? null) as Plain;
      const source: FieldSource = value !== null ? 'panel' : envValue !== null && envValue !== '' ? 'env' : 'none';
      return [name, f.options ? { value, envValue, source, options: f.options } : { value, envValue, source }];
    }),
  );
  const secretFields = Object.fromEntries(
    Object.entries(secrets).map(([name, f]) => {
      const blob = row?.[f.enc] as string | null | undefined;
      const source: FieldSource = blob ? 'panel' : env[f.env] ? 'env' : 'none';
      return [name, { configured: source !== 'none', source, hint: blob ? ((row?.[f.hint] as string | null) ?? null) : null, unreadable: blob ? !readable(blob) : false }];
    }),
  );
  return { fields, secrets: secretFields };
}

export function sectionColumns(section: IntegrationSection): RowKey[] {
  const { plain, secrets } = SECTION_FIELDS[section];
  return [...Object.values(plain).map((f) => f.column), ...Object.values(secrets).flatMap((f) => [f.enc, f.hint])];
}
