import type { StorageConfig } from '../integrations/integration-config.js';

const encodeKey = (key: string) => key.split('/').map(encodeURIComponent).join('/');

export function publicObjectUrl(cfg: StorageConfig, key: string): string {
  const path = encodeKey(cfg.keyPrefix + key);
  const base = cfg.publicEndpoint ?? cfg.endpoint;
  if (!base) return `https://${cfg.bucket}.s3.${cfg.region}.amazonaws.com/${path}`;
  const url = new URL(base);
  const root = url.pathname.replace(/\/+$/, '');
  if (cfg.forcePathStyle) return `${url.origin}${root}/${cfg.bucket}/${path}`;
  return `${url.protocol}//${cfg.bucket}.${url.host}${root}/${path}`;
}
