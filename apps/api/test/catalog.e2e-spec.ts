// Stage 2 end-to-end tests: photos (real S3-compatible storage), products,
// variants, inventory movements, plan limits, AI credits and tenant isolation.
//
// Requires: DATABASE_URL -> a *_test database (migrated + seeded) and an
// S3-compatible endpoint (development `storage` service on localhost:8333).
// The AI recognizer is replaced by a test double to exercise the credit logic;
// the real Claude call is covered by the last suite, which only runs when
// ANTHROPIC_API_KEY is set.
import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import sharp from 'sharp';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { ClaudeGarmentRecognizer } from './../src/ai/claude-garment-recognizer.js';
import {
  GarmentRecognizer,
  RecognitionError,
  type RecognitionImage,
  type RecognitionResult,
} from './../src/ai/garment-recognizer.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { ownerPrisma, testModule } from './support/db.js';

const dbName = new URL(process.env['DATABASE_URL'] ?? 'postgresql://x/none').pathname.slice(1);
if (!dbName.endsWith('_test')) throw new Error(`E2E tests must run on a *_test database (got "${dbName}").`);

Object.assign(process.env, {
  S3_ENDPOINT: process.env['S3_TEST_ENDPOINT'] ?? 'http://localhost:8333',
  S3_PUBLIC_ENDPOINT: '',
  S3_BUCKET: 'modaflow-test',
  S3_ACCESS_KEY_ID: process.env['S3_ACCESS_KEY_ID'] ?? 'modaflow-dev',
  S3_SECRET_ACCESS_KEY: process.env['S3_SECRET_ACCESS_KEY'] ?? 'modaflow-dev-secret',
  S3_AUTO_CREATE_BUCKET: 'true',
});

/** Test double for the vision model (the real one is ClaudeGarmentRecognizer). */
class FakeRecognizer extends GarmentRecognizer {
  readonly configured = true;
  readonly model = 'test-double';
  mode: 'ok' | 'fail' = 'ok';
  delayMs = 0;
  calls = 0;
  lastImages: RecognitionImage[] = [];

  async recognize(images: RecognitionImage[]): Promise<RecognitionResult> {
    this.calls++;
    this.lastImages = images;
    if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs));
    if (this.mode === 'fail') throw new RecognitionError('AI_UNAVAILABLE', 'simulated outage', true);
    return {
      model: this.model,
      inputTokens: 1000,
      outputTokens: 120,
      suggestion: {
        isGarment: true,
        name: 'Blusa roja de manga larga',
        description: 'Blusa roja con escote en V y mangas largas.',
        garmentType: 'Blusa',
        category: 'blusas',
        mainColor: 'Rojo',
        secondaryColors: ['rojo', 'Blanco'],
        size: null,
        style: 'Casual',
        features: ['manga larga', 'escote en V'],
        tags: ['blusa', 'rojo', 'Manga larga', 'manga larga', 'casual'],
        message: '',
      },
    };
  }
}

const run = Date.now().toString(36);
let ipCounter = 0;
const PASSWORD = 'Moda2026segura';
const idem = () => randomUUID().replace(/-/g, '');

async function photo(color = '#c0392b', width = 900, height = 1200): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: color } }).jpeg({ quality: 90 }).toBuffer();
}

describe('Catalog, inventory and AI (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let server: App;
  const fake = new FakeRecognizer();

  const agent = () => {
    const ip = `198.18.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;
    const a = request.agent(server);
    return {
      get: (url: string) => a.get(url).set('X-Forwarded-For', ip),
      post: (url: string) => a.post(url).set('X-Forwarded-For', ip),
      patch: (url: string) => a.patch(url).set('X-Forwarded-For', ip),
      put: (url: string) => a.put(url).set('X-Forwarded-For', ip),
      delete: (url: string) => a.delete(url).set('X-Forwarded-For', ip),
    };
  };
  type Agent = ReturnType<typeof agent>;

  async function newStore(name: string) {
    const a = agent();
    const email = `${name}.${run}.${ipCounter}@e2e.test`;
    await a.post('/auth/register').send({ name, email, password: PASSWORD }).expect(201);
    const res = await a
      .post('/onboarding')
      .send({ name: `Tienda ${name}`, whatsapp: `6${Math.floor(1_000_000 + Math.random() * 8_999_999)}`, city: 'La Paz', primaryColor: '#6C4CF5' })
      .expect(201);
    return { a, tenantId: res.body.tenantId as string };
  }

  let defaultPhoto: Buffer;
  function upload(a: Agent, productId: string, body?: Buffer, contentType = 'image/jpeg') {
    return a
      .post('/product-images')
      .field('productId', productId)
      .attach('file', body ?? defaultPhoto, { filename: 'foto.jpg', contentType });
  }

  function createProduct(a: Agent, overrides: Record<string, unknown> = {}) {
    return a.post('/products').send({
      name: 'Pantalón jean',
      salePrice: '120',
      variants: [{ size: 'M', quantity: 2 }],
      ...overrides,
    });
  }

  beforeAll(async () => {
    defaultPhoto = await photo();
    const moduleRef = await testModule(AppModule, 'modaflow_app')
      .overrideProvider(GarmentRecognizer)
      .useValue(fake)
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    prisma = ownerPrisma();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  // -------------------------------------------------------------------------
  describe('photos (S3)', () => {
    it('uploads, optimizes to WebP, serves through signed URLs and blocks unsigned access', async () => {
      const { a, tenantId } = await newStore('fotos');
      const draft = randomUUID();
      const res = await upload(a, draft, await photo('#123456', 3000, 4000)).expect(201);
      expect(res.body).toMatchObject({ width: 1200, height: 1600, isPrimary: false });

      const signed = await fetch(res.body.url);
      expect(signed.status).toBe(200);
      expect(signed.headers.get('content-type')).toBe('image/webp');
      const thumb = await fetch(res.body.thumbUrl);
      expect(thumb.status).toBe(200);
      const meta = await sharp(Buffer.from(await thumb.arrayBuffer())).metadata();
      expect(Math.max(meta.width!, meta.height!)).toBe(480);

      const unsigned = await fetch(res.body.url.split('?')[0]);
      expect(unsigned.status).toBe(403);

      const row = await prisma.productImage.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(row.storageKey).toBe(`tenants/${tenantId}/products/${draft}/${res.body.id}`);
      expect(row.productId).toBeNull();
    });

    it('rejects non-image content even with an image MIME type', async () => {
      const { a } = await newStore('malicioso');
      const fake = Buffer.from('#!/bin/sh\necho pwned\n');
      const res = await upload(a, randomUUID(), fake, 'image/jpeg').expect(415);
      expect(res.body.code).toBe('INVALID_IMAGE');
      await a
        .post('/product-images')
        .field('productId', randomUUID())
        .attach('file', Buffer.from('<svg/>'), { filename: 'x.svg', contentType: 'image/svg+xml' })
        .expect(415);
    });

    it('allows at most 3 photos per garment', async () => {
      const { a } = await newStore('tresfotos');
      const draft = randomUUID();
      for (let i = 0; i < 3; i++) await upload(a, draft).expect(201);
      const res = await upload(a, draft).expect(400);
      expect(res.body.code).toBe('TOO_MANY_IMAGES');
      const many = await a.patch(`/products/${randomUUID()}`).send({ images: { imageIds: Array.from({ length: 4 }, () => randomUUID()) } });
      expect(many.status).toBe(400);
    });

    it('deletes a pending photo from storage', async () => {
      const { a } = await newStore('borrar');
      const res = await upload(a, randomUUID()).expect(201);
      await a.delete(`/product-images/${res.body.id}`).expect(204);
      expect((await fetch(res.body.url)).status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  describe('products and variants', () => {
    it('registers a garment manually with photos, variants, initial stock and tags', async () => {
      const { a } = await newStore('blusas');
      const draft = randomUUID();
      const img1 = (await upload(a, draft).expect(201)).body;
      const img2 = (await upload(a, draft, await photo('#ffffff')).expect(201)).body;

      const res = await a
        .post('/products')
        .send({
          id: draft,
          name: '  Blusa   casual ',
          description: 'Blusa de verano',
          garmentType: 'Blusa',
          color: 'Rojo',
          categoryName: '  blusas ',
          tags: ['Casual', 'casual', 'Manga larga', 'verano'],
          salePrice: '69.5',
          purchasePrice: '35,50',
          variants: [
            { size: 'S', color: 'Rojo', quantity: 3 },
            { size: 'M', color: 'Rojo', quantity: 2 },
            { size: 'S', color: 'Negra', quantity: 1 },
          ],
          imageIds: [img1.id, img2.id],
          primaryImageId: img2.id,
        })
        .expect(201);

      const p = res.body;
      expect(p).toMatchObject({
        name: 'Blusa casual',
        salePrice: '69.50',
        purchasePrice: '35.50',
        totalStock: 6,
        stockStatus: 'in_stock',
        category: { name: 'Blusas' },
        tags: ['casual', 'manga larga', 'verano'],
      });
      expect(p.sku).toMatch(/^P\d{5}$/);
      expect(p.variants.map((v: { sku: string }) => v.sku)).toEqual([`${p.sku}-S-ROJO`, `${p.sku}-M-ROJO`, `${p.sku}-S-NEGRA`]);
      expect(p.images.map((i: { id: string; isPrimary: boolean }) => [i.id, i.isPrimary])).toEqual([
        [img1.id, false],
        [img2.id, true],
      ]);

      const movements = await a.get(`/inventory/movements?productId=${p.id}`).expect(200);
      expect(movements.body.total).toBe(3);
      expect(movements.body.items.every((m: { type: string; stockBefore: number }) => m.type === 'INITIAL' && m.stockBefore === 0)).toBe(true);

      // Same draft id again (retry): no duplicate product.
      const retry = await a
        .post('/products')
        .send({ id: draft, name: 'Otra', salePrice: '1', variants: [{ quantity: 1 }] })
        .expect(201);
      expect(retry.body.id).toBe(p.id);
      expect(retry.body.name).toBe('Blusa casual');
    });

    it('registers a one-off garment (ropa de fardo) as a single variant', async () => {
      const { a } = await newStore('fardo');
      const res = await createProduct(a, { name: 'Chaqueta de fardo', variants: [{ quantity: 1 }] }).expect(201);
      expect(res.body.variants).toHaveLength(1);
      expect(res.body.variants[0]).toMatchObject({ size: null, color: null, stock: 1, sku: res.body.sku });
    });

    it('validates prices, quantities and duplicated variants', async () => {
      const { a } = await newStore('validar');
      const zero = await createProduct(a, { salePrice: '0' }).expect(400);
      expect(zero.body.errors.salePrice).toBeDefined();
      const neg = await createProduct(a, { variants: [{ size: 'M', quantity: -1 }] }).expect(400);
      expect(neg.body.code).toBe('VALIDATION_ERROR');
      const noVariants = await createProduct(a, { variants: [] }).expect(400);
      expect(noVariants.body.errors.variants).toBeDefined();
      const dup = await createProduct(a, { variants: [{ size: 'm', quantity: 1 }, { size: ' M ', quantity: 1 }] }).expect(409);
      expect(dup.body.code).toBe('DUPLICATE_VARIANT');
      await createProduct(a, { salePrice: 12.345 }).expect(400);
      await createProduct(a, { tenantId: randomUUID() }).expect(400);
    });

    it('edits fields, tags, photos and adds variants without touching stock directly', async () => {
      const { a } = await newStore('editar');
      const draft = randomUUID();
      const img1 = (await upload(a, draft).expect(201)).body;
      const img2 = (await upload(a, draft, await photo('#00ff00')).expect(201)).body;
      const created = (await createProduct(a, { id: draft, imageIds: [img1.id, img2.id], tags: ['jean'] }).expect(201)).body;

      const img3 = (await upload(a, draft, await photo('#0000ff')).expect(201)).body;
      const updated = await a
        .patch(`/products/${created.id}`)
        .send({
          name: 'Pantalón jean azul',
          salePrice: '135',
          purchasePrice: null,
          tags: ['denim', 'azul'],
          images: { imageIds: [img3.id, img1.id], primaryImageId: img3.id },
          variantsAdd: [{ size: 'L', quantity: 4 }],
          variantsUpdate: [{ id: created.variants[0].id, sku: 'JEAN-M' }],
        })
        .expect(200);
      expect(updated.body).toMatchObject({ name: 'Pantalón jean azul', salePrice: '135.00', purchasePrice: null, tags: ['azul', 'denim'], totalStock: 6 });
      expect(updated.body.images.map((i: { id: string }) => i.id)).toEqual([img3.id, img1.id]);
      expect(updated.body.images[0].isPrimary).toBe(true);
      expect(updated.body.variants.map((v: { sku: string; stock: number }) => [v.sku, v.stock])).toEqual([
        ['JEAN-M', 2],
        [`${created.sku}-L`, 4],
      ]);
      // The removed photo is gone from storage too.
      expect((await fetch(img2.url)).status).toBe(404);
      // Stock cannot be set through the product endpoint.
      await a.patch(`/products/${created.id}`).send({ totalStock: 99 }).expect(400);
    });

    it('searches and filters with server-side pagination', async () => {
      const { a } = await newStore('buscar');
      const cats = (await a.get('/categories').expect(200)).body as { id: string; name: string }[];
      const vestidos = cats.find((c) => c.name === 'Vestidos')!;
      await createProduct(a, { name: 'Vestido floral', categoryId: vestidos.id, color: 'Azul', salePrice: '150', tags: ['verano', 'Floral'], variants: [{ size: 'S', quantity: 1 }] }).expect(201);
      await createProduct(a, { name: 'Camisa blanca', color: 'Blanco', salePrice: '90', variants: [{ size: 'L', quantity: 0 }] }).expect(201);
      const jean = (await createProduct(a, { name: 'Jean clásico', color: 'Azul', salePrice: '120', variants: [{ size: 'M', quantity: 10 }] }).expect(201)).body;

      const q = async (qs: string) => (await a.get(`/products?${qs}`).expect(200)).body;
      expect((await q('search=floral')).items.map((p: { name: string }) => p.name)).toEqual(['Vestido floral']);
      expect((await q(`search=${jean.sku}`)).items[0].id).toBe(jean.id);
      expect((await q('search=VERANO')).total).toBe(1);
      expect((await q(`categoryId=${vestidos.id}`)).total).toBe(1);
      expect((await q('color=azul')).total).toBe(2);
      expect((await q('size=l')).total).toBe(1);
      expect((await q('availability=out_of_stock')).items[0].name).toBe('Camisa blanca');
      expect((await q('availability=low_stock')).items[0].name).toBe('Vestido floral');
      expect((await q('sort=price_asc')).items.map((p: { salePrice: string }) => p.salePrice)).toEqual(['90.00', '120.00', '150.00']);
      const page = await q('pageSize=2&page=2&sort=oldest');
      expect(page).toMatchObject({ total: 3, page: 2, pageSize: 2, totalPages: 2 });
      expect(page.items).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  describe('inventory movements', () => {
    it('records entries, exits and adjustments with a consistent ledger', async () => {
      const { a } = await newStore('stock');
      const p = (await createProduct(a, { variants: [{ size: 'M', quantity: 2 }] }).expect(201)).body;
      const variantId = p.variants[0].id;

      const entry = await a.post('/inventory/entries').send({ variantId, quantity: 5, reason: 'Llegó mercadería', idempotencyKey: idem() }).expect(201);
      expect(entry.body).toMatchObject({ type: 'STOCK_IN', stockBefore: 2, stockAfter: 7 });
      await a.post('/inventory/exits').send({ variantId, quantity: 1, reason: 'Prenda dañada', idempotencyKey: idem() }).expect(201);
      await a.post('/inventory/adjustments').send({ variantId, quantity: 2, direction: 'OUT', reason: 'Conteo físico', idempotencyKey: idem() }).expect(201);
      await a.post('/inventory/adjustments').send({ variantId, quantity: 1, direction: 'IN', reason: 'Conteo físico', idempotencyKey: idem() }).expect(201);

      const short = await a.post('/inventory/exits').send({ variantId, quantity: 50, reason: 'Error', idempotencyKey: idem() }).expect(409);
      expect(short.body).toMatchObject({ code: 'INSUFFICIENT_STOCK', available: 5 });
      await a.post('/inventory/exits').send({ variantId, quantity: 1, idempotencyKey: idem() }).expect(400);
      await a.post('/inventory/entries').send({ variantId, quantity: 0, idempotencyKey: idem() }).expect(400);

      // Retrying with the same key does not apply the movement twice.
      const key = idem();
      const first = await a.post('/inventory/entries').send({ variantId, quantity: 3, idempotencyKey: key }).expect(201);
      const again = await a.post('/inventory/entries').send({ variantId, quantity: 3, idempotencyKey: key }).expect(201);
      expect(again.body.id).toBe(first.body.id);

      const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
      const product = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
      expect(variant.stock).toBe(8);
      expect(product.totalStock).toBe(8);
      const history = (await a.get(`/inventory/movements?variantId=${variantId}&pageSize=100`).expect(200)).body.items.reverse();
      expect(history.map((m: { type: string }) => m.type)).toEqual(['INITIAL', 'STOCK_IN', 'MANUAL_OUT', 'ADJUSTMENT_OUT', 'ADJUSTMENT_IN', 'STOCK_IN']);
      for (let i = 1; i < history.length; i++) expect(history[i].stockBefore).toBe(history[i - 1].stockAfter);
      expect(history.at(-1).stockAfter).toBe(variant.stock);

      const inv = (await a.get('/inventory').expect(200)).body;
      expect(inv.summary).toMatchObject({ products: 1, units: 8, lowStock: 0, outOfStock: 0 });
    });

    it('never goes negative under concurrent exits', async () => {
      const { a } = await newStore('concurrente');
      const p = (await createProduct(a, { variants: [{ size: 'M', quantity: 5 }] }).expect(201)).body;
      const variantId = p.variants[0].id;
      const results = await Promise.all(
        Array.from({ length: 12 }, () =>
          a.post('/inventory/exits').send({ variantId, quantity: 1, reason: 'Prueba simultánea', idempotencyKey: idem() }),
        ),
      );
      expect(results.filter((r) => r.status === 201)).toHaveLength(5);
      expect(results.filter((r) => r.status === 409)).toHaveLength(7);
      const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
      expect(variant.stock).toBe(0);
      expect(await prisma.inventoryMovement.count({ where: { variantId, type: 'MANUAL_OUT' } })).toBe(5);
    });
  });

  // -------------------------------------------------------------------------
  describe('plan limits, archive and subscription', () => {
    it('enforces the product limit even with simultaneous requests; archived products free a slot', async () => {
      const { a, tenantId } = await newStore('limite');
      // Fill 28 of the 30 trial slots directly, then race 6 creations for the last 2.
      const store = await prisma.store.findFirstOrThrow({ where: { tenantId } });
      const user = await prisma.tenantMembership.findFirstOrThrow({ where: { tenantId } });
      await prisma.product.createMany({
        data: Array.from({ length: 28 }, (_, i) => ({
          tenantId, storeId: store.id, createdById: user.userId, sku: `SEED-${i}`, slug: `seed-${i}`, name: `Seed ${i}`, salePrice: '10',
        })),
      });
      const results = await Promise.all(Array.from({ length: 6 }, (_, i) => createProduct(a, { name: `Carrera ${i}` })));
      expect(results.filter((r) => r.status === 201)).toHaveLength(2);
      const rejected = results.filter((r) => r.status === 403);
      expect(rejected).toHaveLength(4);
      expect(rejected[0]!.body).toMatchObject({ code: 'PLAN_LIMIT_REACHED', max: 30 });
      expect(await prisma.product.count({ where: { tenantId, status: 'ACTIVE' } })).toBe(30);

      const sub = (await a.get('/subscription').expect(200)).body;
      expect(sub.limits.products).toEqual({ limit: 30, used: 30 });

      // Editing still works at the limit.
      const someId = results.find((r) => r.status === 201)!.body.id as string;
      await a.patch(`/products/${someId}`).send({ name: 'Editado al límite' }).expect(200);

      // Archive frees a slot; restoring needs a free slot again.
      await a.delete(`/products/${someId}`).expect(204);
      expect((await a.get('/products?status=archived').expect(200)).body.total).toBe(1);
      await createProduct(a, { name: 'Ocupa el lugar' }).expect(201);
      const blocked = await a.post(`/products/${someId}/restore`).expect(403);
      expect(blocked.body.code).toBe('PLAN_LIMIT_REACHED');
      const archived = await prisma.product.findUniqueOrThrow({ where: { id: someId }, include: { variants: true } });
      await a.post('/inventory/entries').send({ variantId: archived.variants[0]!.id, quantity: 1, idempotencyKey: idem() }).expect(409);
    });

    it('blocks new operations when the subscription expired but keeps data readable', async () => {
      const { a, tenantId } = await newStore('vencida');
      const p = (await createProduct(a).expect(201)).body;
      await prisma.subscription.update({ where: { tenantId }, data: { currentPeriodEnd: new Date(Date.now() - 1000) } });
      expect((await createProduct(a).expect(403)).body.code).toBe('SUBSCRIPTION_INACTIVE');
      await a.patch(`/products/${p.id}`).send({ name: 'x y' }).expect(403);
      await a.post('/inventory/entries').send({ variantId: p.variants[0].id, quantity: 1, idempotencyKey: idem() }).expect(403);
      await a.get('/products').expect(200);
      await a.get(`/products/${p.id}`).expect(200);
      await a.get('/inventory').expect(200);
    });
  });

  // -------------------------------------------------------------------------
  describe('categories', () => {
    it('creates defaults and prevents duplicates by case, accents or spaces', async () => {
      const { a } = await newStore('categorias');
      const list = (await a.get('/categories').expect(200)).body.map((c: { name: string }) => c.name);
      expect(list).toEqual(expect.arrayContaining(['Blusas', 'Camisas', 'Pantalones', 'Vestidos', 'Faldas', 'Chaquetas', 'Poleras', 'Shorts', 'Accesorios', 'Otros']));
      expect(list.at(-1)).toBe('Otros');
      expect((await a.post('/categories').send({ name: '  blúsas ' }).expect(409)).body.code).toBe('CATEGORY_EXISTS');
      const created = (await a.post('/categories').send({ name: 'ropa  interior' }).expect(201)).body;
      expect(created.name).toBe('Ropa interior');
      const renamed = (await a.patch(`/categories/${created.id}`).send({ name: 'Lencería' }).expect(200)).body;
      expect(renamed.name).toBe('Lencería');
    });
  });

  // -------------------------------------------------------------------------
  describe('tenant isolation', () => {
    it('never exposes or modifies another store’s products, stock, photos or credits', async () => {
      const A = await newStore('aislaA');
      const B = await newStore('aislaB');
      const draft = randomUUID();
      const imgA = (await upload(A.a, draft).expect(201)).body;
      const pA = (await createProduct(A.a, { id: draft, imageIds: [imgA.id] }).expect(201)).body;

      await B.a.get(`/products/${pA.id}`).expect(404);
      await B.a.patch(`/products/${pA.id}`).send({ name: 'hackeado' }).expect(404);
      await B.a.delete(`/products/${pA.id}`).expect(404);
      expect((await B.a.get('/products').expect(200)).body.total).toBe(0);
      expect((await B.a.get(`/inventory/movements?productId=${pA.id}`).expect(200)).body.total).toBe(0);
      expect((await B.a.post('/inventory/exits').send({ variantId: pA.variants[0].id, quantity: 1, reason: 'robo', idempotencyKey: idem() }).expect(404)).body.code).toBe('VARIANT_NOT_FOUND');
      // Photos: cannot upload into A's product, attach A's photo, delete it or analyze it.
      await upload(B.a, pA.id).expect(404);
      await createProduct(B.a, { imageIds: [imgA.id] }).expect(404);
      await B.a.delete(`/product-images/${imgA.id}`).expect(404);
      const usedBefore = (await B.a.get('/ai/usage').expect(200)).body.used;
      expect((await B.a.post('/ai/analyze-garment').send({ imageIds: [imgA.id], idempotencyKey: idem() }).expect(404)).body.code).toBe('IMAGE_NOT_FOUND');
      expect((await B.a.get('/ai/usage').expect(200)).body.used).toBe(usedBefore);

      const stillA = await prisma.product.findUniqueOrThrow({ where: { id: pA.id } });
      expect(stillA.name).toBe('Pantalón jean');
      expect(stillA.totalStock).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  describe('AI garment analysis and credits', () => {
    beforeEach(() => {
      fake.mode = 'ok';
      fake.delayMs = 0;
    });

    it('analyzes photos, charges one credit, returns editable suggestions and never prices', async () => {
      const { a } = await newStore('ia');
      const draft = randomUUID();
      const i1 = (await upload(a, draft).expect(201)).body;
      const i2 = (await upload(a, draft, await photo('#eeeeee')).expect(201)).body;

      const res = await a.post('/ai/analyze-garment').send({ imageIds: [i1.id, i2.id], idempotencyKey: idem() }).expect(200);
      expect(res.body).toMatchObject({ status: 'SUCCEEDED', creditsCharged: 1, usage: { limit: 10, used: 1, remaining: 9 } });
      expect(res.body.suggestion).toMatchObject({
        name: 'Blusa roja de manga larga',
        category: { name: 'Blusas' },
        color: 'Rojo',
        secondaryColors: ['Blanco'],
        size: null,
        tags: ['blusa', 'rojo', 'manga larga', 'casual'],
      });
      expect(JSON.stringify(res.body.suggestion)).not.toMatch(/precio|price|cantidad|marca/i);
      // Both photos reached the model as optimized WebP.
      expect(fake.lastImages.map((img) => img.mediaType)).toEqual(['image/webp', 'image/webp']);

      // Saving the product with the (edited) suggestion links the analysis.
      const product = (
        await a
          .post('/products')
          .send({ id: draft, name: 'Blusa roja manga larga', categoryId: res.body.suggestion.category.id, tags: res.body.suggestion.tags, salePrice: '75', variants: [{ size: 'M', quantity: 1 }], imageIds: [i1.id, i2.id], aiAnalysisId: res.body.id })
          .expect(201)
      ).body;
      expect(product.aiAssisted).toBe(true);
    });

    it('is idempotent: retrying with the same key does not charge again', async () => {
      const { a } = await newStore('iaidem');
      const img = (await upload(a, randomUUID()).expect(201)).body;
      const key = idem();
      const callsBefore = fake.calls;
      const first = await a.post('/ai/analyze-garment').send({ imageIds: [img.id], idempotencyKey: key }).expect(200);
      const second = await a.post('/ai/analyze-garment').send({ imageIds: [img.id], idempotencyKey: key }).expect(200);
      expect(second.body.id).toBe(first.body.id);
      expect(second.body.usage.used).toBe(1);
      expect(fake.calls - callsBefore).toBe(1);
    });

    it('does not consume a credit when the analysis fails', async () => {
      const { a } = await newStore('iafalla');
      const img = (await upload(a, randomUUID()).expect(201)).body;
      fake.mode = 'fail';
      const res = await a.post('/ai/analyze-garment').send({ imageIds: [img.id], idempotencyKey: idem() }).expect(503);
      expect(res.body.code).toBe('AI_UNAVAILABLE');
      const usage = (await a.get('/ai/usage').expect(200)).body;
      expect(usage.used).toBe(0);
      expect(usage.recent[0]).toMatchObject({ status: 'FAILED', creditsCharged: 0 });
    });

    it('never exceeds the plan limit, even with simultaneous requests', async () => {
      const { a, tenantId } = await newStore('ialimite');
      const img = (await upload(a, randomUUID()).expect(201)).body;
      // Trial: 10 analyses in total. Leave 2 available, then fire 6 at once.
      const sub = await prisma.subscription.findUniqueOrThrow({ where: { tenantId } });
      await prisma.subscriptionUsage.create({
        data: { tenantId, metric: 'AI_ANALYSES', periodStart: sub.startedAt, periodEnd: sub.currentPeriodEnd, used: 8 },
      });
      fake.delayMs = 150;
      const results = await Promise.all(
        Array.from({ length: 6 }, () => a.post('/ai/analyze-garment').send({ imageIds: [img.id], idempotencyKey: idem() })),
      );
      expect(results.filter((r) => r.status === 200)).toHaveLength(2);
      const limited = results.filter((r) => r.status === 403);
      expect(limited).toHaveLength(4);
      expect(limited[0]!.body.code).toBe('PLAN_LIMIT_REACHED');
      const usage = (await a.get('/ai/usage').expect(200)).body;
      expect(usage).toMatchObject({ limit: 10, used: 10, remaining: 0, period: 'TOTAL' });
      // Manual registration still works without credits.
      await createProduct(a).expect(201);
    });

    it('validates the request (1 to 3 photos, idempotency key)', async () => {
      const { a } = await newStore('iavalida');
      await a.post('/ai/analyze-garment').send({ imageIds: [], idempotencyKey: idem() }).expect(400);
      await a.post('/ai/analyze-garment').send({ imageIds: Array.from({ length: 4 }, () => randomUUID()), idempotencyKey: idem() }).expect(400);
      await a.post('/ai/analyze-garment').send({ imageIds: [randomUUID()] }).expect(400);
    });
  });
});

// Real Claude API call: only when a key is available (never simulated).
describe.skipIf(!process.env['ANTHROPIC_API_KEY'])('Claude garment recognition (real API)', () => {
  it('recognizes a garment photo and returns the structured suggestion', async () => {
    const { ConfigService } = await import('@nestjs/config');
    const config = new ConfigService({
      ANTHROPIC_API_KEY: process.env['ANTHROPIC_API_KEY'],
      ANTHROPIC_MODEL: process.env['ANTHROPIC_MODEL'] ?? 'claude-opus-5-5',
      AI_TIMEOUT_MS: 90_000,
    });
    const model = process.env['ANTHROPIC_MODEL'] ?? 'claude-opus-5-5';
    const integrations = { snapshot: () => ({ storage: null, email: null, ai: { apiKey: process.env['ANTHROPIC_API_KEY'] ?? '', model } }) };
    const recognizer = new ClaudeGarmentRecognizer(integrations as never, config as never);
    const path = process.env['AI_TEST_IMAGE'];
    if (!path) throw new Error('Set AI_TEST_IMAGE to a garment photo to run the real Claude test.');
    const { readFileSync } = await import('node:fs');
    const data = await sharp(readFileSync(path)).resize(1600, 1600, { fit: 'inside' }).webp().toBuffer();
    const result = await recognizer.recognize([{ data, mediaType: 'image/webp' }], ['Blusas', 'Vestidos', 'Chaquetas', 'Otros']);
    expect(result.suggestion.isGarment).toBe(true);
    expect(result.suggestion.name.length).toBeGreaterThan(2);
  }, 120_000);
});
