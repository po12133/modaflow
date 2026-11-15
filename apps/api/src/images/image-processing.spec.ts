import sharp from 'sharp';
import { processProductImage, storageKeyFor } from './image-processing.js';

const make = (format: 'jpeg' | 'png' | 'webp' | 'gif', width = 2400, height = 3200) =>
  sharp({ create: { width, height, channels: 3, background: '#aa3344' } })[format]().toBuffer();

describe('processProductImage', () => {
  it('converts JPEG/PNG/WebP to WebP within 1600px (main) and 480px (thumb)', async () => {
    for (const format of ['jpeg', 'png', 'webp'] as const) {
      const out = await processProductImage(await make(format));
      expect(out.contentType).toBe('image/webp');
      expect([out.width, out.height]).toEqual([1200, 1600]);
      const thumb = await sharp(out.thumb).metadata();
      expect(thumb.format).toBe('webp');
      expect(Math.max(thumb.width!, thumb.height!)).toBe(480);
    }
  });

  it('does not enlarge small photos', async () => {
    const out = await processProductImage(await make('jpeg', 300, 200));
    expect([out.width, out.height]).toEqual([300, 200]);
  });

  it('strips metadata (EXIF/GPS) from stored photos', async () => {
    const withExif = await sharp(await make('jpeg', 400, 400))
      .withExif({ IFD0: { Make: 'TestCam', Copyright: 'secreto' } })
      .jpeg()
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();
    const out = await processProductImage(withExif);
    expect((await sharp(out.main).metadata()).exif).toBeUndefined();
  });

  it.each([
    ['plain text', Buffer.from('hola, no soy una imagen')],
    ['shell script', Buffer.from('#!/bin/sh\nrm -rf /\n')],
    ['svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')],
  ])('rejects %s', async (_label, buf) => {
    await expect(processProductImage(buf)).rejects.toMatchObject({ response: { code: 'INVALID_IMAGE' } });
  });

  it('rejects formats outside the allow-list (GIF)', async () => {
    await expect(processProductImage(await make('gif', 50, 50))).rejects.toMatchObject({ response: { code: 'INVALID_IMAGE' } });
  });

  it('builds per-tenant, per-product object keys', () => {
    expect(storageKeyFor('t1', 'p1', 'i1')).toBe('tenants/t1/products/p1/i1');
  });
});
