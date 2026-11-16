import 'reflect-metadata';
import { validateAdminEnv } from './admin-env.js';

const base = { DATABASE_URL: 'postgresql://a:b@h:5432/d', NODE_ENV: 'test' };

describe('admin environment', () => {
  it('treats empty backup variables as not configured', () => {
    const env = validateAdminEnv({ ...base, BACKUP_ENCRYPTION_KEY: '', BACKUP_DB_PASSWORD: '' });
    expect(env.BACKUP_ENCRYPTION_KEY).toBeUndefined();
    expect(env.BACKUP_DB_PASSWORD).toBeUndefined();
  });

  it('rejects a malformed backup key and a short backup password', () => {
    expect(() => validateAdminEnv({ ...base, BACKUP_ENCRYPTION_KEY: 'abc' })).toThrow('BACKUP_ENCRYPTION_KEY');
    expect(() => validateAdminEnv({ ...base, BACKUP_DB_PASSWORD: 'corta' })).toThrow('BACKUP_DB_PASSWORD');
    expect(() => validateAdminEnv({ ...base, BACKUP_ENCRYPTION_KEY: 'f'.repeat(64), BACKUP_DB_PASSWORD: 'x'.repeat(16) })).not.toThrow();
  });
});
