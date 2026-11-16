import { decryptSecret, encryptSecret, isEncryptionKey, secretHint } from '../common/secret-box.js';
import { type IntegrationRow, isLocalEndpoint, normalizeKeyPrefix, resolveIntegrations, withoutBucketHost } from './integration-config.js';

const KEY = 'a'.repeat(64);
const decrypt = (blob: string) => {
  try {
    return decryptSecret(blob, KEY);
  } catch {
    return null;
  }
};
const empty: IntegrationRow = {
  s3Endpoint: null, s3PublicEndpoint: null, s3Region: null, s3Bucket: null,
  s3AccessKeyIdEnc: null, s3AccessKeyIdHint: null, s3SecretAccessKeyEnc: null, s3SecretAccessKeyHint: null,
  s3KeyPrefix: null, s3PublicUrls: null, anthropicApiKeyEnc: null, anthropicApiKeyHint: null, anthropicModel: null,
  smtpHost: null, smtpPort: null, smtpSecure: null, smtpUser: null, smtpPasswordEnc: null, smtpPasswordHint: null, smtpFromEmail: null, smtpFromName: null,
};

describe('secret box', () => {
  it('encrypts with a random IV and detects tampering or a wrong key', () => {
    const a = encryptSecret('sk-ant-secreto', KEY);
    expect(a).not.toContain('sk-ant');
    expect(encryptSecret('sk-ant-secreto', KEY)).not.toBe(a);
    expect(decryptSecret(a, KEY)).toBe('sk-ant-secreto');
    expect(() => decryptSecret(a, 'b'.repeat(64))).toThrow();
    expect(() => decryptSecret(a.slice(0, -2) + 'xx', KEY)).toThrow();
    expect(isEncryptionKey(KEY)).toBe(true);
    expect(isEncryptionKey('corta')).toBe(false);
    expect(secretHint('abcdefghijkl1234')).toBe('1234');
    expect(secretHint('corta')).toBeNull();
  });
});

describe('integration resolution', () => {
  it('falls back to environment variables field by field', () => {
    const env = { S3_BUCKET: 'env-bucket', S3_ACCESS_KEY_ID: 'env-id', S3_SECRET_ACCESS_KEY: 'env-secret', ANTHROPIC_API_KEY: 'env-key', SMTP_HOST: 'smtp.env', SMTP_FROM_EMAIL: 'no-reply@env.bo' };
    const env1 = resolveIntegrations(null, env, decrypt);
    expect(env1.storage).toMatchObject({ bucket: 'env-bucket', region: 'us-east-1', forcePathStyle: false });
    expect(env1.ai).toEqual({ apiKey: 'env-key', model: 'claude-opus-5-5' });
    expect(env1.email).toMatchObject({ host: 'smtp.env', port: 587, secure: false, fromName: 'ModaFlow' });

    const row = { ...empty, s3Bucket: 'panel-bucket', s3SecretAccessKeyEnc: encryptSecret('panel-secret', KEY), anthropicModel: 'claude-sonnet-5-5', smtpPort: 465, smtpSecure: true };
    const mixed = resolveIntegrations(row, env, decrypt);
    expect(mixed.storage).toMatchObject({ bucket: 'panel-bucket', accessKeyId: 'env-id', secretAccessKey: 'panel-secret' });
    expect(mixed.ai?.model).toBe('claude-sonnet-5-5');
    expect(mixed.email).toMatchObject({ port: 465, secure: true });
  });

  it('removes the bucket from an endpoint that already includes it', () => {
    expect(withoutBucketHost('https://amicornios.nbg1.your-objectstorage.com', 'amicornios')).toBe('https://nbg1.your-objectstorage.com');
    expect(withoutBucketHost('https://nbg1.your-objectstorage.com', 'amicornios')).toBe('https://nbg1.your-objectstorage.com');
    expect(withoutBucketHost(undefined, 'amicornios')).toBeUndefined();
    expect(isLocalEndpoint('http://storage:8333')).toBe(true);
    expect(isLocalEndpoint('http://localhost:8333')).toBe(true);
    expect(isLocalEndpoint('http://10.0.0.5:9000')).toBe(true);
    expect(isLocalEndpoint('https://nbg1.your-objectstorage.com')).toBe(false);
    expect(isLocalEndpoint(undefined)).toBe(false);
    const env = { S3_BUCKET: 'amicornios', S3_ACCESS_KEY_ID: 'i', S3_SECRET_ACCESS_KEY: 's', S3_PUBLIC_ENDPOINT: 'https://amicornios.nbg1.your-objectstorage.com/' };
    expect(resolveIntegrations(null, env, decrypt).storage).toMatchObject({ publicEndpoint: 'https://nbg1.your-objectstorage.com', forcePathStyle: false });
  });

  it('normalizes the folder inside the bucket', () => {
    expect(normalizeKeyPrefix(undefined)).toBe('');
    expect(normalizeKeyPrefix(' /modaflow/ ')).toBe('modaflow/');
    expect(normalizeKeyPrefix('clientes/modaflow')).toBe('clientes/modaflow/');
    const env = { S3_BUCKET: 'b', S3_ACCESS_KEY_ID: 'i', S3_SECRET_ACCESS_KEY: 's', S3_KEY_PREFIX: 'env' };
    expect(resolveIntegrations(null, env, decrypt).storage?.keyPrefix).toBe('env/');
    expect(resolveIntegrations({ ...empty, s3KeyPrefix: 'panel' }, env, decrypt).storage?.keyPrefix).toBe('panel/');
  });

  it('disables a section when required values are missing or a secret cannot be decrypted', () => {
    expect(resolveIntegrations(null, {}, decrypt)).toEqual({ storage: null, ai: null, email: null });
    const broken = { ...empty, anthropicApiKeyEnc: encryptSecret('x', 'b'.repeat(64)) };
    expect(resolveIntegrations(broken, { ANTHROPIC_API_KEY: 'env-key' }, decrypt).ai).toBeNull();
    expect(resolveIntegrations({ ...empty, smtpHost: 'smtp.panel' }, {}, decrypt).email).toBeNull();
  });
});
