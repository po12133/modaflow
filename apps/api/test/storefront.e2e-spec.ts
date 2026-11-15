import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

const dbName = new URL(process.env['DATABASE_URL'] ?? 'postgresql://x/none').pathname.slice(1);
if (!dbName.endsWith('_test')) throw new Error(`E2E tests must run on a *_test database (got "${dbName}").`);

const run = Date.now().toString(36);
let ipCounter = 0;
const PASSWORD = 'Moda2026segura';

describe('Online catalog (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let server: App;

  const agent = () => {
    const ip = `198.21.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;
    const a = request.agent(server);
    return {
      get: (url: string) => a.get(url).set('X-Forwarded-For', ip),
      post: (url: string) => a.post(url).set('X-Forwarded-For', ip),
      patch: (url: string) => a.patch(url).set('X-Forwarded-For', ip),
    };
  };
  type Agent = ReturnType<typeof agent>;

  async function newStore(name: string) {
    const a = agent();
    await a.post('/auth/register').send({ name: `${name} Pérez`, email: `${name}.${run}.${ipCounter}@e2e.test`, password: PASSWORD }).expect(201);
    const res = await a
      .post('/onboarding')
      .send({ name: `Tienda ${name} ${run}`, whatsapp: `7${Math.floor(1_000_000 + Math.random() * 8_999_999)}`, city: 'La Paz', primaryColor: '#E8457E' })
      .expect(201);
    const cats = (await a.get('/categories').expect(200)).body as { id: string; name: string }[];
    return { a, tenantId: res.body.tenantId as string, cat: (n: string) => cats.find((c) => c.name === n)!.id };
  }

  const product = async (a: Agent, body: Record<string, unknown>) =>
    (await a.post('/products').send(body).expect(201)).body as { id: string; slug: string; variants: { id: string; sku: string; size: string | null }[] };

  const setPlan = async (tenantId: string, code: string, extra: Record<string, unknown> = {}) => {
    const plan = await prisma.plan.findUniqueOrThrow({ where: { code } });
    await prisma.subscription.update({ where: { tenantId }, data: { planId: plan.id, planVersionId: (await prisma.planVersion.findFirstOrThrow({ where: { planId: plan.id }, orderBy: { version: 'desc' } })).id, status: 'ACTIVE', ...extra } });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('a published catalog', () => {
    let s: Awaited<ReturnType<typeof newStore>>;
    let slug: string;
    let blusa: Awaited<ReturnType<typeof product>>;
    let vestido: Awaited<ReturnType<typeof product>>;
    let agotada: Awaited<ReturnType<typeof product>>;
    const pub = () => agent();

    beforeAll(async () => {
      s = await newStore('mio');
      slug = `mio-${run}`;
      const settings = (await s.a.get('/catalog/settings').expect(200)).body;
      expect(settings).toMatchObject({ status: 'PUBLISHED', outOfStock: 'SHOW', planAllowsCatalog: true, isPublic: true });
      await s.a.patch('/catalog/settings').send({ slug, description: 'Moda femenina', secondaryColor: '#c98b98' }).expect(200);
      blusa = await product(s.a, {
        name: 'Blusa roja',
        salePrice: '85',
        purchasePrice: '40',
        color: 'Rojo',
        tags: ['verano'],
        categoryId: s.cat('Blusas'),
        variants: [{ size: 'S', quantity: 2 }, { size: 'M', quantity: 15 }, { size: 'L', quantity: 0 }],
      });
      vestido = await product(s.a, { name: 'Vestido azul', salePrice: '150', color: 'Azul', categoryId: s.cat('Vestidos'), variants: [{ quantity: 1 }] });
      agotada = await product(s.a, { name: 'Falda agotada', salePrice: '60', categoryId: s.cat('Faldas'), variants: [{ size: 'M', quantity: 0 }] });
      await product(s.a, { name: 'Polera privada', salePrice: '40', variants: [{ quantity: 3 }] });
      await s.a.post('/catalog/products/bulk-update').send({ ids: [blusa.id, vestido.id, agotada.id], catalogPublished: true }).expect(201);
    });

    it('validates and reserves slugs', async () => {
      expect((await s.a.patch('/catalog/settings').send({ slug: 'dashboard' }).expect(400)).body.code).toBe('SLUG_INVALID');
      expect((await s.a.patch('/catalog/settings').send({ slug: 'Mi Tienda' }).expect(400)).body.code).toBe('SLUG_INVALID');
      const other = await newStore('otra');
      expect((await other.a.patch('/catalog/settings').send({ slug }).expect(409)).body.code).toBe('SLUG_TAKEN');
      expect((await other.a.get(`/catalog/slug-availability?slug=${slug}`).expect(200)).body.available).toBe(false);
      expect((await s.a.get(`/catalog/slug-availability?slug=${slug}`).expect(200)).body.available).toBe(true);
    });

    it('shows only published active products, without private data, to anonymous buyers', async () => {
      const store = (await pub().get(`/public/stores/${slug}`).expect(200)).body;
      expect(store).toMatchObject({ slug, description: 'Moda femenina', secondaryColor: '#C98B98' });
      expect(store).not.toHaveProperty('tenantId');
      const list = (await pub().get(`/public/stores/${slug}/products`).expect(200)).body;
      expect(list.items.map((p: { name: string }) => p.name).sort()).toEqual(['Blusa roja', 'Falda agotada', 'Vestido azul']);
      const raw = JSON.stringify(list);
      for (const secret of ['purchasePrice', 'tenantId', '"id"', 'totalStock', '40.00']) expect(raw).not.toContain(secret);
      const card = list.items.find((p: { name: string }) => p.name === 'Blusa roja');
      expect(card).toMatchObject({ price: '85.00', category: 'Blusas', sizes: ['S', 'M'], available: true, slug: blusa.slug });
      expect(list.items.find((p: { name: string }) => p.name === 'Falda agotada').available).toBe(false);
    });

    it('searches, filters, sorts and paginates on the server', async () => {
      const names = async (qs: string) => (await pub().get(`/public/stores/${slug}/products?${qs}`).expect(200)).body.items.map((p: { name: string }) => p.name);
      expect(await names('search=verano')).toEqual(['Blusa roja']);
      expect(await names('search=vestidos')).toEqual(['Vestido azul']);
      expect(await names('category=blusas')).toEqual(['Blusa roja']);
      expect(await names('size=m')).toEqual(['Blusa roja']);
      expect(await names('color=azul')).toEqual(['Vestido azul']);
      expect(await names('minPrice=80&maxPrice=100')).toEqual(['Blusa roja']);
      expect(await names('availability=available&sort=price_asc')).toEqual(['Blusa roja', 'Vestido azul']);
      expect(await names('sort=price_desc')).toEqual(['Vestido azul', 'Blusa roja', 'Falda agotada']);
      expect(await names('sort=name')).toEqual(['Blusa roja', 'Falda agotada', 'Vestido azul']);
      const page = (await pub().get(`/public/stores/${slug}/products?pageSize=2&page=2&sort=name`).expect(200)).body;
      expect(page).toMatchObject({ total: 3, totalPages: 2, items: [{ name: 'Vestido azul' }] });
      const cats = (await pub().get(`/public/stores/${slug}/categories`).expect(200)).body;
      expect(cats.map((c: { slug: string }) => c.slug)).toEqual(['blusas', 'faldas', 'vestidos']);
    });

    it('product detail exposes variants with capped availability', async () => {
      const d = (await pub().get(`/public/stores/${slug}/products/${blusa.slug}`).expect(200)).body;
      expect(d).toMatchObject({ name: 'Blusa roja', price: '85.00', category: 'Blusas', available: true });
      expect(d.variants.map((v: { size: string; available: number }) => [v.size, v.available])).toEqual([['S', 2], ['M', 10], ['L', 0]]);
      expect(JSON.stringify(d)).not.toContain('purchasePrice');
    });

    it('hides out-of-stock products when configured, and unpublished ones always', async () => {
      await s.a.patch('/catalog/settings').send({ outOfStock: 'HIDE' }).expect(200);
      await pub().get(`/public/stores/${slug}/products/${agotada.slug}`).expect(404);
      const list = (await pub().get(`/public/stores/${slug}/products`).expect(200)).body;
      expect(list.items.map((p: { name: string }) => p.name)).not.toContain('Falda agotada');
      await s.a.patch('/catalog/settings').send({ outOfStock: 'SHOW' }).expect(200);
      await s.a.patch(`/catalog/products/${vestido.id}`).send({ catalogPublished: false }).expect(200);
      await pub().get(`/public/stores/${slug}/products/${vestido.slug}`).expect(404);
      expect((await prisma.product.findUniqueOrThrow({ where: { id: vestido.id } })).totalStock).toBe(1);
      await s.a.patch(`/catalog/products/${vestido.id}`).send({ catalogPublished: true }).expect(200);
    });

    it('creates order requests with server prices, WhatsApp message and no stock change', async () => {
      const m = blusa.variants.find((v) => v.size === 'M')!;
      const res = await pub()
        .post(`/public/stores/${slug}/order-requests`)
        .send({ items: [{ productSlug: blusa.slug, sku: m.sku, quantity: 2 }, { productSlug: vestido.slug, sku: vestido.variants[0]!.sku, quantity: 1 }] })
        .expect(201);
      expect(res.body.total).toBe('320.00');
      expect(res.body.message).toContain('1. Blusa roja — Talla M — 2 unidades — Bs 170');
      expect(res.body.message).toContain('Total referencial: Bs 320.');
      const store = await prisma.store.findFirstOrThrow({ where: { tenantId: s.tenantId } });
      expect(res.body.whatsappUrl).toBe(`https://wa.me/${store.whatsapp.replace('+', '')}?text=${encodeURIComponent(res.body.message)}`);
      expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: m.id } })).stock).toBe(15);
      expect(await prisma.sale.count({ where: { tenantId: s.tenantId } })).toBe(0);

      await pub().post(`/public/stores/${slug}/order-requests/${res.body.code}/whatsapp`).send({ token: 'x'.repeat(32) }).expect(404);
      await pub().post(`/public/stores/${slug}/order-requests/${res.body.code}/whatsapp`).send({ token: res.body.token }).expect(200);
      const list = (await s.a.get('/catalog/order-requests').expect(200)).body;
      expect(list.items[0]).toMatchObject({ code: res.body.code, status: 'WHATSAPP_OPENED', total: '320.00', itemCount: 2, unitCount: 3 });
      const detail = (await s.a.get(`/catalog/order-requests/${list.items[0].id}`).expect(200)).body;
      expect(detail.items[0]).toMatchObject({ productName: 'Blusa roja', size: 'M', quantity: 2, unitPrice: '85.00', lineTotal: '170.00' });
      expect((await s.a.patch(`/catalog/order-requests/${detail.id}`).send({ status: 'ATTENDED' }).expect(200)).body.status).toBe('ATTENDED');
      expect((await s.a.get('/catalog/summary').expect(200)).body).toMatchObject({ published: 3, hidden: 1, publishedOutOfStock: 1, requests: 1 });
    });

    it('rejects unavailable or excessive quantities and unpublished products', async () => {
      const s1 = blusa.variants.find((v) => v.size === 'S')!;
      const tooMany = await pub().post(`/public/stores/${slug}/order-requests`).send({ items: [{ productSlug: blusa.slug, sku: s1.sku, quantity: 3 }] }).expect(409);
      expect(tooMany.body.issues).toEqual([{ index: 0, code: 'INSUFFICIENT_STOCK', available: 2 }]);
      const out = await pub()
        .post(`/public/stores/${slug}/order-requests`)
        .send({ items: [{ productSlug: agotada.slug, sku: agotada.variants[0]!.sku, quantity: 1 }] })
        .expect(409);
      expect(out.body.issues[0].code).toBe('OUT_OF_STOCK');
      const privada = await prisma.product.findFirstOrThrow({ where: { tenantId: s.tenantId, name: 'Polera privada' }, include: { variants: true } });
      const hidden = await pub().post(`/public/stores/${slug}/order-requests`).send({ items: [{ productSlug: privada.slug, sku: privada.variants[0]!.sku, quantity: 1 }] }).expect(409);
      expect(hidden.body.issues[0].code).toBe('NOT_FOUND');
      await pub().post(`/public/stores/${slug}/order-requests`).send({ items: [{ productSlug: blusa.slug, sku: s1.sku, quantity: 11 }] }).expect(400);
    });

    it('isolates tenants: other stores cannot reach these products', async () => {
      const other = await newStore('ajena');
      const otherSlug = (await other.a.get('/catalog/settings').expect(200)).body.slug;
      await pub().get(`/public/stores/${otherSlug}/products/${blusa.slug}`).expect(404);
      const m = blusa.variants.find((v) => v.size === 'M')!;
      const res = await pub().post(`/public/stores/${otherSlug}/order-requests`).send({ items: [{ productSlug: blusa.slug, sku: m.sku, quantity: 1 }] }).expect(409);
      expect(res.body.issues[0].code).toBe('NOT_FOUND');
      expect((await other.a.get('/catalog/order-requests').expect(200)).body.total).toBe(0);
      await other.a.patch(`/catalog/products/${blusa.id}`).send({ catalogPublished: false }).expect(404);
    });

    it('hidden catalog answers a neutral 404 and keeps everything', async () => {
      await s.a.patch('/catalog/settings').send({ status: 'HIDDEN' }).expect(200);
      const res = await pub().get(`/public/stores/${slug}`).expect(404);
      expect(res.body).toMatchObject({ code: 'CATALOG_UNAVAILABLE' });
      expect(JSON.stringify(res.body)).not.toMatch(/plan|suscrip/i);
      await s.a.patch('/catalog/settings').send({ status: 'PUBLISHED' }).expect(200);
      const map = (await pub().get('/public/sitemap').expect(200)).body;
      expect(map.stores.map((x: { slug: string }) => x.slug)).toContain(slug);
      expect(map.products.filter((p: { store: string }) => p.store === slug)).toHaveLength(3);
    });
  });

  it('plans: Básico cannot publish, Pro can, an expired trial goes offline without losing data', async () => {
    const s = await newStore('planes');
    const p = await product(s.a, { name: 'Camisa', salePrice: '70', variants: [{ quantity: 2 }] });
    await s.a.patch(`/catalog/products/${p.id}`).send({ catalogPublished: true }).expect(200);
    const slug = (await s.a.get('/catalog/settings').expect(200)).body.slug;
    await agent().get(`/public/stores/${slug}/products/${p.slug}`).expect(200);

    await prisma.subscription.update({ where: { tenantId: s.tenantId }, data: { currentPeriodEnd: new Date(Date.now() - 1000) } });
    await agent().get(`/public/stores/${slug}`).expect(404);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).catalogPublished).toBe(true);

    await setPlan(s.tenantId, 'basico', { currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000) });
    await agent().get(`/public/stores/${slug}`).expect(404);
    expect((await s.a.get('/catalog/settings').expect(200)).body).toMatchObject({ planAllowsCatalog: false, isPublic: false });
    expect((await s.a.patch(`/catalog/products/${p.id}`).send({ catalogPublished: false }).expect(403)).body.code).toBe('FEATURE_NOT_IN_PLAN');
    expect((await s.a.patch('/catalog/settings').send({ description: 'x' }).expect(403)).body.code).toBe('FEATURE_NOT_IN_PLAN');

    await setPlan(s.tenantId, 'pro');
    await agent().get(`/public/stores/${slug}/products/${p.slug}`).expect(200);
  });
});
