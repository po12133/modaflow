import { decryptSecret, encryptSecret, isEncryptionKey, secretHint } from '../common/secret-box.js';
import { type IntegrationRow, resolveIntegrations } from './integration-config.js';

const KEY = 'a'.repeat(64);
const decrypt = (blob: string) => {
  try {
    return decryptSecret(blob, KEY);
  } catch {
    return null;
  }
};
const empty: IntegrationRow = {
  s3Endpoint: null, s3PublicEndpoint: null, s3Region: null, s3Bucket: null, s3ForcePathStyle: null,
  s3AccessKeyIdEnc: null, s3AccessKeyIdHint: null, s3SecretAccessKeyEnc: null, s3SecretAccessKeyHint: null,
  anthropicApiKeyEnc: null, anthropicApiKeyHint: null, anthropicModel: null,
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
    expect(env1.storage).toMatchObject({ bucket: 'env-bucket', region: 'us-east-1', forcePathStyle: true });
    expect(env1.ai).toEqual({ apiKey: 'env-key', model: 'claude-opus-5-5' });
    expect(env1.email).toMatchObject({ host: 'smtp.env', port: 587, secure: false, fromName: 'ModaFlow' });

    const row = { ...empty, s3Bucket: 'panel-bucket', s3SecretAccessKeyEnc: encryptSecret('panel-secret', KEY), anthropicModel: 'claude-sonnet-5-5', smtpPort: 465, smtpSecure: true };
    const mixed = resolveIntegrations(row, env, decrypt);
    expect(mixed.storage).toMatchObject({ bucket: 'panel-bucket', accessKeyId: 'env-id', secretAccessKey: 'panel-secret' });
    expect(mixed.ai?.model).toBe('claude-sonnet-5-5');
    expect(mixed.email).toMatchObject({ port: 465, secure: true });
  });

  it('disables a section when required values are missing or a secret cannot be decrypted', () => {
    expect(resolveIntegrations(null, {}, decrypt)).toEqual({ storage: null, ai: null, email: null });
    const broken = { ...empty, anthropicApiKeyEnc: encryptSecret('x', 'b'.repeat(64)) };
    expect(resolveIntegrations(broken, { ANTHROPIC_API_KEY: 'env-key' }, decrypt).ai).toBeNull();
    expect(resolveIntegrations({ ...empty, smtpHost: 'smtp.panel' }, {}, decrypt).email).toBeNull();
  });
});
