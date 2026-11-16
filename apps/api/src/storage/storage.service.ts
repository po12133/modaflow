import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { HttpStatus, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppError } from '../common/app-error.js';
import { EnvironmentVariables } from '../config/env.validation.js';
import type { StorageConfig } from '../integrations/integration-config.js';
import { IntegrationConfigService } from '../integrations/integration-config.service.js';
import { publicObjectUrl } from './object-url.js';

interface Clients {
  key: string;
  client: S3Client;
  signer: S3Client;
  bucket: string;
  prefix: string;
  cfg: StorageConfig;
}

export function s3Clients(cfg: StorageConfig): { client: S3Client; signer: S3Client } {
  const base = { region: cfg.region, credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey }, forcePathStyle: cfg.forcePathStyle };
  const publicEndpoint = cfg.publicEndpoint ?? cfg.endpoint;
  return {
    client: new S3Client({ ...base, ...(cfg.endpoint ? { endpoint: cfg.endpoint } : {}) }),
    signer: new S3Client({ ...base, ...(publicEndpoint ? { endpoint: publicEndpoint } : {}) }),
  };
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly signedUrlTtl: number;
  private readonly autoCreateBucket: boolean;
  private clients: Clients | null = null;

  constructor(
    private readonly integrations: IntegrationConfigService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.signedUrlTtl = config.get('S3_SIGNED_URL_TTL_SECONDS', { infer: true }) ?? 3600;
    this.autoCreateBucket = config.get('S3_AUTO_CREATE_BUCKET', { infer: true }) ?? false;
  }

  async onModuleInit(): Promise<void> {
    await this.integrations.refresh();
    const state = this.state();
    if (!state) {
      this.logger.warn('S3 storage is not configured (admin panel or S3_* variables): photo upload disabled.');
      return;
    }
    if (!this.autoCreateBucket || (await this.ping())) return;
    try {
      await state.client.send(new CreateBucketCommand({ Bucket: state.bucket }));
      this.logger.log(`Created bucket "${state.bucket}"`);
    } catch (error) {
      this.logger.warn(`Could not create bucket "${state.bucket}": ${(error as Error).name}`);
    }
  }

  private state(): Clients | null {
    const cfg = this.integrations.snapshot().storage;
    if (!cfg) return null;
    const key = JSON.stringify(cfg);
    if (this.clients?.key !== key) this.clients = { key, bucket: cfg.bucket, prefix: cfg.keyPrefix, cfg, ...s3Clients(cfg) };
    return this.clients;
  }

  get isConfigured(): boolean {
    return this.state() !== null;
  }

  assertConfigured(): void {
    this.require();
  }

  private require(): Clients {
    const state = this.state();
    if (!state) {
      throw new AppError(
        HttpStatus.SERVICE_UNAVAILABLE,
        'STORAGE_NOT_CONFIGURED',
        'La subida de archivos no está disponible: falta configurar el almacenamiento S3 en el panel de administración.',
      );
    }
    return state;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const { client, bucket, prefix } = this.require();
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: prefix + key, Body: body, ContentType: contentType, CacheControl: 'private, max-age=31536000, immutable' }));
  }

  async get(key: string): Promise<Buffer> {
    const { client, bucket, prefix } = this.require();
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: prefix + key }));
    if (!res.Body) throw new Error(`Empty object ${key}`);
    return Buffer.from(await res.Body.transformToByteArray());
  }

  async deleteMany(keys: string[]): Promise<void> {
    const state = this.state();
    if (keys.length === 0 || !state) return;
    await state.client.send(new DeleteObjectsCommand({ Bucket: state.bucket, Delete: { Objects: keys.map((key) => ({ Key: state.prefix + key })), Quiet: true } }));
  }

  /** Image URL for the browser: short and direct when the bucket is public, signed otherwise. */
  async fileUrl(key: string): Promise<string | null> {
    const state = this.state();
    if (!state) return null;
    return state.cfg.publicUrls ? publicObjectUrl(state.cfg, key) : this.privateFileUrl(key);
  }

  /** Always signed and temporary (payment receipts). */
  async privateFileUrl(key: string): Promise<string | null> {
    const state = this.state();
    if (!state) return null;
    return getSignedUrl(state.signer, new GetObjectCommand({ Bucket: state.bucket, Key: state.prefix + key }), { expiresIn: this.signedUrlTtl });
  }

  async downloadUrl(key: string, fileName: string): Promise<string | null> {
    const state = this.state();
    if (!state) return null;
    const command = new GetObjectCommand({ Bucket: state.bucket, Key: state.prefix + key, ResponseContentDisposition: `attachment; filename="${fileName}"` });
    return getSignedUrl(state.signer, command, { expiresIn: 300 });
  }

  async listAll(): Promise<{ prefix: string; items: { key: string; size: number; lastModified: string | null }[] }> {
    const { client, bucket, prefix } = this.require();
    const items: { key: string; size: number; lastModified: string | null }[] = [];
    let token: string | undefined;
    do {
      const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix || undefined, ContinuationToken: token }));
      for (const o of page.Contents ?? []) {
        if (o.Key) items.push({ key: o.Key.slice(prefix.length), size: o.Size ?? 0, lastModified: o.LastModified?.toISOString() ?? null });
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return { prefix, items };
  }

  async ping(): Promise<boolean> {
    const state = this.state();
    if (!state) return false;
    try {
      await state.client.send(new HeadBucketCommand({ Bucket: state.bucket }));
      return true;
    } catch {
      return false;
    }
  }
}
