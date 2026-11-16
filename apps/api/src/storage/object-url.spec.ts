import type { StorageConfig } from '../integrations/integration-config.js';
import { publicObjectUrl } from './object-url.js';

const base: StorageConfig = { region: 'eu-central', bucket: 'amicornios', accessKeyId: 'i', secretAccessKey: 's', forcePathStyle: false, keyPrefix: 'modaflow/', publicUrls: true };

describe('publicObjectUrl', () => {
  it('builds short virtual-hosted URLs', () => {
    expect(publicObjectUrl({ ...base, endpoint: 'https://nbg1.your-objectstorage.com' }, 'tenants/t/products/p/a-thumb.webp')).toBe(
      'https://amicornios.nbg1.your-objectstorage.com/modaflow/tenants/t/products/p/a-thumb.webp',
    );
  });

  it('supports path style, AWS without endpoint and no folder', () => {
    expect(publicObjectUrl({ ...base, endpoint: 'http://storage:8333', publicEndpoint: 'http://localhost:8333', forcePathStyle: true, keyPrefix: '' }, 'a.webp')).toBe('http://localhost:8333/amicornios/a.webp');
    expect(publicObjectUrl(base, 'a b.webp')).toBe('https://amicornios.s3.eu-central.amazonaws.com/modaflow/a%20b.webp');
  });
});
