import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { HttpStatus, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppError } from '../common/app-error.js';
import { EnvironmentVariables } from '../config/env.validation.js';

/**
 * S3-compatible object storage (AWS S3, Cloudflare R2, MinIO...).
 * Objects are private: browsers only get short-lived signed URLs.
 * Nothing is ever written to the container filesystem.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client | null;
  /** Client used only to sign URLs for browsers (may use a public endpoint). */
  private readonly signer: S3Client | null;
  private readonly bucket: string | null;
  private readonly signedUrlTtl: number;
  private readonly autoCreateBucket: boolean;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    // '' means unset (compose passes empty strings for optional variables).
    const str = (key: 'S3_BUCKET' | 'S3_ACCESS_KEY_ID' | 'S3_SECRET_ACCESS_KEY' | 'S3_ENDPOINT' | 'S3_PUBLIC_ENDPOINT' | 'S3_REGION') =>
      config.get(key, { infer: true }) || undefined;
    const bucket = str('S3_BUCKET');
    const accessKeyId = str('S3_ACCESS_KEY_ID');
    const secretAccessKey = str('S3_SECRET_ACCESS_KEY');
    this.signedUrlTtl = config.get('S3_SIGNED_URL_TTL_SECONDS', { infer: true }) ?? 3600;
    this.autoCreateBucket = config.get('S3_AUTO_CREATE_BUCKET', { infer: true }) ?? false;

    if (!bucket || !accessKeyId || !secretAccessKey) {
      this.client = this.signer = null;
      this.bucket = null;
      this.logger.warn('S3 storage is not configured (S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY): photo upload disabled.');
      return;
    }

    const endpoint = str('S3_ENDPOINT');
    const base = {
      region: str('S3_REGION') ?? 'us-east-1',
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: config.get('S3_FORCE_PATH_STYLE', { infer: true }) ?? true,
    };
    this.bucket = bucket;
    this.client = new S3Client({ ...base, ...(endpoint ? { endpoint } : {}) });
    const publicEndpoint = str('S3_PUBLIC_ENDPOINT') ?? endpoint;
    this.signer = new S3Client({ ...base, ...(publicEndpoint ? { endpoint: publicEndpoint } : {}) });
  }

  /** Development convenience (S3_AUTO_CREATE_BUCKET): creates the bucket if missing. */
  async onModuleInit(): Promise<void> {
    if (!this.autoCreateBucket || !this.client || !this.bucket) return;
    if (await this.ping()) return;
    try {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Created bucket "${this.bucket}"`);
    } catch (error) {
      this.logger.warn(`Could not create bucket "${this.bucket}": ${(error as Error).name}`);
    }
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  /** Throws STORAGE_NOT_CONFIGURED (503) when S3 credentials are missing. */
  assertConfigured(): void {
    this.require();
  }

  private require(): { client: S3Client; signer: S3Client; bucket: string } {
    if (!this.client || !this.signer || !this.bucket) {
      throw new AppError(
        HttpStatus.SERVICE_UNAVAILABLE,
        'STORAGE_NOT_CONFIGURED',
        'El almacenamiento de fotografías todavía no está configurado. Puedes registrar la prenda sin fotos.',
      );
    }
    return { client: this.client, signer: this.signer, bucket: this.bucket };
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const { client, bucket } = this.require();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'private, max-age=31536000, immutable',
      }),
    );
  }

  async get(key: string): Promise<Buffer> {
    const { client, bucket } = this.require();
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!res.Body) throw new Error(`Empty object ${key}`);
    return Buffer.from(await res.Body.transformToByteArray());
  }

  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0 || !this.client || !this.bucket) return;
    await this.client.send(
      new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }

  /** Short-lived URL to read a private object. Returns null when storage is off. */
  async signedUrl(key: string): Promise<string | null> {
    if (!this.signer || !this.bucket) return null;
    return getSignedUrl(this.signer, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: this.signedUrlTtl,
    });
  }

  /** Connectivity probe (bucket reachable with the configured credentials). */
  async ping(): Promise<boolean> {
    if (!this.client || !this.bucket) return false;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }
}
