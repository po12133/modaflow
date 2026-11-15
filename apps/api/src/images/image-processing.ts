import { HttpStatus } from '@nestjs/common';
import sharp from 'sharp';
import { AppError } from '../common/app-error.js';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGES_PER_PRODUCT = 3;
/** Formats accepted after decoding the real file content (not the client's MIME type). */
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);
/** Refuse decompression bombs: ~50 megapixels. */
const MAX_INPUT_PIXELS = 50_000_000;

export interface ProcessedImage {
  main: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
  contentType: 'image/webp';
}

/**
 * Validates an uploaded photo by decoding it and produces optimized WebP
 * versions: main (max 1600px, used for detail and AI analysis) and thumb
 * (max 480px, used in lists). EXIF orientation is applied and all metadata
 * (including GPS) is stripped.
 */
export async function processProductImage(input: Buffer): Promise<ProcessedImage> {
  let format: string | undefined;
  try {
    const meta = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
    format = meta.format;
  } catch {
    throw invalidImage();
  }
  if (!format || !ALLOWED_FORMATS.has(format)) throw invalidImage();

  try {
    const base = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' }).rotate();
    const main = await base
      .clone()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    const thumb = await base
      .clone()
      .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer();
    return { main: main.data, thumb, width: main.info.width, height: main.info.height, contentType: 'image/webp' };
  } catch {
    throw invalidImage();
  }
}

function invalidImage() {
  return new AppError(
    HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    'INVALID_IMAGE',
    'El archivo no es una imagen válida. Usa fotos JPG, PNG o WebP.',
  );
}

/** Object keys: tenants/{tenant}/products/{product}/{image}-main.webp (and -thumb). */
export function imageKeys(storageKey: string) {
  return { main: `${storageKey}-main.webp`, thumb: `${storageKey}-thumb.webp` };
}

export function storageKeyFor(tenantId: string, productId: string, imageId: string): string {
  return `tenants/${tenantId}/products/${productId}/${imageId}`;
}
