// Stage 3 end-to-end tests: POS, sales, stock, receipts and cancellations
// against a real PostgreSQL *_test database.
import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PasswordService } from './../src/auth/password.service.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { ownerPrisma, testModule } from './support/db.js';

const dbName = new URL(process.env['DATABASE_URL'] ?? 'postgresql://x/none').pathname.slice(1);
if (!dbName.endsWith('_test')) throw new Error(`E2E tests must run on a *_test database (got "${dbName}").`);

const run = Date.now().toString(36);
let ipCounter = 0;
const PASSWORD = 'Moda2026segura';
const key = () => randomUUID().replace(/-/g, '');

describe('Sales and POS (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let server: App;

  const agent = () => {
    const ip = `198.19.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;
    const a = request.agent(server);
    return {
      get: (url: string) => a.get(url).set('X-Forwarded-For', ip),
      post: (url: string) => a.post(url).set('X-Forwarded-For', ip),
      patch: (url: string) => a.patch(url).set('X-Forwarded-For', ip),
      delete: (url: string) => a.delete(url).set('X-Forwarded-For', ip),
    };
  };
  type Agent = ReturnType<typeof agent>;

  async function newStore(name: string) {
    const a = agent();
    const email = `${name}.${run}.${ipCounter}@e2e.test`;
    await a.post('/auth/register').send({ name: `${name} Pérez`, email, password: PASSWORD }).expect(201);
    const res = await a
      .post('/onboarding')
      .send({ name: `Tienda ${name}`, whatsapp: `6${Math.floor(1_000_000 + Math.random() * 8_999_999)}`, city: 'Cochabamba', primaryColor: '#FF5C8A' })
      .expect(201);
    return { a, tenantId: res.body.tenantId as string };
  }

  async function product(a: Agent, body: Record<string, unknown> = {}) {
    const res = await a
      .post('/products')
      .send({ name: 'Blusa roja', salePrice: '100', variants: [{ size: 'M', quantity: 5 }], ...body })
      .expect(201);
    return res.body as { id: string; sku: string; variants: { id: string; stock: number; size: string | null }[] };
  }

  const sale = (a: Agent, items: { variantId: string; quantity: number; discount?: unknown }[], extra: Record<string, unknown> = {}) =>
    a.post('/sales').send({ items, paymentMethod: 'CASH', paymentConfirmed: true, idempotencyKey: key(), ...extra });

  const stockOf = async (variantId: string) => (await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock;

  beforeAll(async () => {
    const moduleRef = await testModule(AppModule, 'modaflow_app').compile();
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
  describe('POS product search', () => {
    it('finds active, in-stock products by name, SKU, category, tag, color and size', async () => {
      const { a } = await newStore('pos');
      const cats = (await a.get('/categories').expect(200)).body as { id: string; name: string }[];
      const vestidos = cats.find((c) => c.name === 'Vestidos')!;
      const vestido = await product(a, { name: 'Vestido floral', categoryId: vestidos.id, color: 'Azul', tags: ['verano'], variants: [{ size: 'S', quantity: 2 }] });
      await product(a, { name: 'Camisa agotada', variants: [{ size: 'L', quantity: 0 }] });
      const archived = await product(a, { name: 'Falda archivada' });
      await a.delete(`/products/${archived.id}`).expect(204);

      const names = async (qs: string) => (await a.get(`/pos/products?${qs}`).expect(200)).body.items.map((p: { name: string }) => p.name);
      expect(await names('search=floral')).toEqual(['Vestido floral']);
      expect(await names(`search=${vestido.sku}`)).toEqual(['Vestido floral']);
      expect(await names('search=vestidos')).toEqual(['Vestido floral']);
      expect(await names('search=verano')).toEqual(['Vestido floral']);
      expect(await names('color=azul')).toEqual(['Vestido floral']);
      expect(await names('size=s')).toEqual(['Vestido floral']);
      expect(await names('')).not.toContain('Camisa agotada');
      expect(await names('includeOutOfStock=true')).toEqual(expect.arrayContaining(['Camisa agotada', 'Vestido floral']));
      expect(await names('includeOutOfStock=true')).not.toContain('Falda archivada');
      const first = (await a.get('/pos/products?search=floral').expect(200)).body.items[0];
      expect(first).toMatchObject({ salePrice: '100.00', variants: [{ size: 'S', stock: 2 }] });
    });
  });

  // -------------------------------------------------------------------------
  describe('preview and amounts', () => {
    it('computes item and general discounts with current prices without touching stock', async () => {
      const { a } = await newStore('preview');
      const blusa = await product(a, { salePrice: '85', variants: [{ size: 'M', quantity: 3 }] });
      const saco = await product(a, { name: 'Saco', salePrice: '120', variants: [{ quantity: 1 }] });
      const res = await a
        .post('/pos/preview')
        .send({
          items: [
            { variantId: blusa.variants[0]!.id, quantity: 2, discount: { type: 'PERCENT', value: '10' } },
            { variantId: saco.variants[0]!.id, quantity: 1 },
          ],
          discount: { type: 'AMOUNT', value: '23' },
          paymentMethod: 'CASH',
          amountReceived: '300',
        })
        .expect(200);
      expect(res.body).toMatchObject({
        subtotal: '290.00',
        itemsDiscount: '17.00',
        discountAmount: '23.00',
        total: '250.00',
        units: 3,
        change: { receivedCents: 30000, changeCents: 5000 },
        canConfirm: true,
      });
      expect(res.body.items[0]).toMatchObject({ unitPrice: '85.00', unitDiscount: '8.50', finalUnitPrice: '76.50', lineTotal: '153.00' });
      expect(await stockOf(blusa.variants[0]!.id)).toBe(3);

      const short = await a.post('/pos/preview').send({ items: [{ variantId: saco.variants[0]!.id, quantity: 2 }] }).expect(200);
      expect(short.body).toMatchObject({ canConfirm: false, issues: [{ code: 'INSUFFICIENT_STOCK', available: 1 }] });
    });

    it('rejects invalid discounts and client-sent prices or totals', async () => {
      const { a } = await newStore('montos');
      const p = await product(a, { salePrice: '50' });
      const v = p.variants[0]!.id;
      const tooBig = await a.post('/pos/preview').send({ items: [{ variantId: v, quantity: 1, discount: { type: 'AMOUNT', value: '60' } }] }).expect(400);
      expect(tooBig.body.errors['items.0.discount']).toBeDefined();
      const pct = await a.post('/pos/preview').send({ items: [{ variantId: v, quantity: 1 }], discount: { type: 'PERCENT', value: '150' } }).expect(400);
      expect(pct.body.errors.discount).toBeDefined();
      await a.post('/pos/preview').send({ items: [{ variantId: v, quantity: 1, discount: { type: 'AMOUNT', value: '-5' } }] }).expect(400);
      await a.post('/pos/preview').send({ items: [{ variantId: v, quantity: 0 }] }).expect(400);
      // The client can never set prices or totals.
      await sale(a, [{ variantId: v, quantity: 1, unitPrice: '1' } as never]).expect(400);
      await sale(a, [{ variantId: v, quantity: 1 }], { total: '1.00' }).expect(400);
      // Duplicated lines must be merged by the client.
      await a.post('/pos/preview').send({ items: [{ variantId: v, quantity: 1 }, { variantId: v, quantity: 1 }] }).expect(400);
    });
  });

  // -------------------------------------------------------------------------
  describe('confirming sales', () => {
    it('registers the sale, numbers it, snapshots the lines and discounts stock with SALE movements', async () => {
      const { a, tenantId } = await newStore('venta');
      const blusa = await product(a, { name: 'Blusa roja', salePrice: '100', variants: [{ size: 'M', quantity: 5 }] });
      const vM = blusa.variants[0]!.id;

      const first = await sale(a, [{ variantId: vM, quantity: 2, discount: { type: 'AMOUNT', value: '10' } }], {
        discount: { type: 'PERCENT', value: '10' },
        amountReceived: '200',
      }).expect(201);
      expect(first.body).toMatchObject({
        number: 'V-000001',
        status: 'COMPLETED',
        subtotal: '200.00',
        itemsDiscount: '20.00',
        discountAmount: '18.00',
        total: '162.00',
        unitCount: 2,
        paymentMethod: 'CASH',
        amountReceived: '200.00',
        changeGiven: '38.00',
        items: [{ productName: 'Blusa roja', size: 'M', quantity: 2, unitPrice: '100.00', unitDiscount: '10.00', finalUnitPrice: '90.00', lineTotal: '180.00' }],
      });
      expect(first.body.movements).toMatchObject([{ type: 'SALE', quantity: 2, stockBefore: 5, stockAfter: 3 }]);
      expect(await stockOf(vM)).toBe(3);
      expect((await prisma.product.findUniqueOrThrow({ where: { id: blusa.id } })).totalStock).toBe(3);

      const second = await sale(a, [{ variantId: vM, quantity: 1 }], { paymentMethod: 'QR' }).expect(201);
      expect(second.body.number).toBe('V-000002');

      // Later product edits never change past sales.
      await a.patch(`/products/${blusa.id}`).send({ name: 'Blusa renombrada', salePrice: '999' }).expect(200);
      const detail = (await a.get(`/sales/${first.body.id}`).expect(200)).body;
      expect(detail.items[0]).toMatchObject({ productName: 'Blusa roja', unitPrice: '100.00' });
      expect(detail.total).toBe('162.00');

      const movements = await prisma.inventoryMovement.findMany({ where: { tenantId, type: 'SALE' } });
      expect(movements).toHaveLength(2);
      expect(movements.every((m) => m.saleId)).toBe(true);
    });

    it('requires payment confirmation and enough cash', async () => {
      const { a } = await newStore('pago');
      const p = await product(a, { salePrice: '85' });
      const v = p.variants[0]!.id;
      await sale(a, [{ variantId: v, quantity: 1 }], { paymentConfirmed: false }).expect(400);
      await sale(a, [{ variantId: v, quantity: 1 }], { paymentMethod: 'CRYPTO' }).expect(400);
      const cash = await sale(a, [{ variantId: v, quantity: 1 }], { amountReceived: '80' }).expect(400);
      expect(cash.body.errors.amountReceived).toBeDefined();
      expect(await stockOf(v)).toBe(5);
    });

    it('is idempotent: retries and double taps never duplicate the sale', async () => {
      const { a, tenantId } = await newStore('idem');
      const p = await product(a, { variants: [{ size: 'M', quantity: 10 }] });
      const v = p.variants[0]!.id;
      const idempotencyKey = key();
      const results = await Promise.all(Array.from({ length: 5 }, () => sale(a, [{ variantId: v, quantity: 1 }], { idempotencyKey })));
      expect(results.every((r) => r.status === 201)).toBe(true);
      expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
      expect(await prisma.sale.count({ where: { tenantId } })).toBe(1);
      expect(await stockOf(v)).toBe(9);
    });

    it('sells the last unit only once when two sellers try at the same time', async () => {
      const { a, tenantId } = await newStore('ultima');
      const unica = await product(a, { name: 'Chaqueta de fardo', variants: [{ quantity: 1 }] });
      const v = unica.variants[0]!.id;
      const results = await Promise.all(Array.from({ length: 5 }, () => sale(a, [{ variantId: v, quantity: 1 }])));
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      const rejected = results.filter((r) => r.status === 409);
      expect(rejected).toHaveLength(4);
      expect(rejected[0]!.body).toMatchObject({ code: 'INSUFFICIENT_STOCK', available: 0 });
      expect(await stockOf(v)).toBe(0);
      expect(await prisma.sale.count({ where: { tenantId } })).toBe(1);
    });

    it('assigns unique consecutive numbers to simultaneous sales', async () => {
      const { a, tenantId } = await newStore('numeros');
      const p = await product(a, { variants: [{ size: 'M', quantity: 20 }] });
      const q = await product(a, { name: 'Otra', variants: [{ size: 'S', quantity: 20 }] });
      const results = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          sale(a, [
            { variantId: (i % 2 ? p : q).variants[0]!.id, quantity: 1 },
            { variantId: (i % 2 ? q : p).variants[0]!.id, quantity: 1 },
          ]),
        ),
      );
      expect(results.every((r) => r.status === 201)).toBe(true);
      const numbers = results.map((r) => r.body.number).sort((a: string, b: string) => a.localeCompare(b));
      expect(numbers).toEqual(Array.from({ length: 8 }, (_, i) => `V-${String(i + 1).padStart(6, '0')}`));
      expect(await stockOf(p.variants[0]!.id)).toBe(12);
      expect(await stockOf(q.variants[0]!.id)).toBe(12);
      const ledger = await prisma.inventoryMovement.count({ where: { tenantId, type: 'SALE' } });
      expect(ledger).toBe(16);
    });

    it('rolls back everything when one line has no stock', async () => {
      const { a, tenantId } = await newStore('rollback');
      const ok = await product(a, { variants: [{ size: 'M', quantity: 5 }] });
      const poco = await product(a, { name: 'Poco stock', variants: [{ size: 'S', quantity: 1 }] });
      await sale(a, [
        { variantId: ok.variants[0]!.id, quantity: 2 },
        { variantId: poco.variants[0]!.id, quantity: 3 },
      ]).expect(409);
      expect(await stockOf(ok.variants[0]!.id)).toBe(5);
      expect(await prisma.sale.count({ where: { tenantId } })).toBe(0);
      expect(await prisma.inventoryMovement.count({ where: { tenantId, type: 'SALE' } })).toBe(0);
      // The number was not consumed: the next sale is still V-000001.
      expect((await sale(a, [{ variantId: ok.variants[0]!.id, quantity: 1 }]).expect(201)).body.number).toBe('V-000001');
    });

    it('cannot sell archived products', async () => {
      const { a } = await newStore('archivado');
      const p = await product(a);
      await a.delete(`/products/${p.id}`).expect(204);
      expect((await sale(a, [{ variantId: p.variants[0]!.id, quantity: 1 }]).expect(409)).body.code).toBe('PRODUCT_UNAVAILABLE');
    });
  });

  // -------------------------------------------------------------------------
  describe('receipts', () => {
    it('serves the receipt as JSON and PDF, and through a revocable public link', async () => {
      const { a } = await newStore('boleta');
      const p = await product(a, { name: 'Blusa ñandú', salePrice: '85' });
      const s = (await sale(a, [{ variantId: p.variants[0]!.id, quantity: 1 }]).expect(201)).body;

      const receipt = (await a.get(`/sales/${s.id}/receipt`).expect(200)).body;
      expect(receipt).toMatchObject({ number: 'V-000001', total: '85.00', store: { name: 'Tienda boleta', city: 'Cochabamba' } });
      expect(receipt.notice).toMatch(/no es una factura fiscal/i);

      const pdf = await a.get(`/sales/${s.id}/receipt/pdf`).buffer(true).parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      }).expect(200);
      expect(pdf.headers['content-type']).toBe('application/pdf');
      expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');

      const link = (await a.post(`/sales/${s.id}/receipt-link`).expect(200)).body;
      expect(link.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
      expect((await a.post(`/sales/${s.id}/receipt-link`).expect(200)).body.token).toBe(link.token);

      const anonymous = request(server);
      const pub = (await anonymous.get(`/receipts/${link.token}`).set('X-Forwarded-For', '203.0.113.200').expect(200)).body;
      expect(pub).toMatchObject({ number: 'V-000001', total: '85.00', seller: 'boleta' });
      expect(JSON.stringify(pub)).not.toMatch(/tenantId|productId|variantId|"id"/);
      await anonymous.get(`/receipts/${link.token}/pdf`).set('X-Forwarded-For', '203.0.113.200').expect(200);

      await a.delete(`/sales/${s.id}/receipt-link`).expect(204);
      await anonymous.get(`/receipts/${link.token}`).set('X-Forwarded-For', '203.0.113.200').expect(404);
      await anonymous.get(`/receipts/${'x'.repeat(32)}`).set('X-Forwarded-For', '203.0.113.200').expect(404);
    });
  });

  // -------------------------------------------------------------------------
  describe('cancellations', () => {
    it('cancels once, restores stock with SALE_CANCEL movements and keeps the sale', async () => {
      const { a, tenantId } = await newStore('anular');
      const p = await product(a, { variants: [{ size: 'M', quantity: 5 }] });
      const v = p.variants[0]!.id;
      const s = (await sale(a, [{ variantId: v, quantity: 3 }]).expect(201)).body;
      expect(await stockOf(v)).toBe(2);

      await a.post(`/sales/${s.id}/cancel`).send({ reason: 'x' }).expect(400);
      const cancelKey = key();
      const results = await Promise.all(
        Array.from({ length: 3 }, (_, i) => a.post(`/sales/${s.id}/cancel`).send({ reason: 'Talla equivocada', idempotencyKey: i === 0 ? cancelKey : key() })),
      );
      const ok = results.filter((r) => r.status === 200);
      expect(ok.length).toBeGreaterThanOrEqual(1);
      expect(results.filter((r) => r.status === 409).every((r) => r.body.code === 'SALE_ALREADY_CANCELED')).toBe(true);
      expect(await stockOf(v)).toBe(5);
      expect(await prisma.inventoryMovement.count({ where: { tenantId, type: 'SALE_CANCEL' } })).toBe(1);

      const detail = (await a.get(`/sales/${s.id}`).expect(200)).body;
      expect(detail).toMatchObject({ status: 'CANCELED', cancellation: { reason: 'Talla equivocada', restockedUnits: 3 } });
      expect(detail.movements.map((m: { type: string }) => m.type)).toEqual(['SALE', 'SALE_CANCEL']);

      // Retrying the winning request with its key is not an error.
      const winnerKey = (await prisma.saleCancellation.findUniqueOrThrow({ where: { saleId: s.id } })).idempotencyKey!;
      await a.post(`/sales/${s.id}/cancel`).send({ reason: 'Talla equivocada', idempotencyKey: winnerKey }).expect(200);
      expect(await stockOf(v)).toBe(5);
      expect(await prisma.sale.count({ where: { id: s.id } })).toBe(1);
    });

    it('only the owner can cancel', async () => {
      const { a, tenantId } = await newStore('roles');
      const p = await product(a);
      const s = (await sale(a, [{ variantId: p.variants[0]!.id, quantity: 1 }]).expect(201)).body;

      const email = `vendedora.${run}.${ipCounter}@e2e.test`;
      const passwordHash = await app.get(PasswordService).hash(PASSWORD);
      const user = await prisma.user.create({ data: { name: 'Vendedora', email, passwordHash } });
      await prisma.tenantMembership.create({ data: { tenantId, userId: user.id, role: 'SELLER' } });
      const seller = agent();
      await seller.post('/auth/login').send({ email, password: PASSWORD }).expect(200);

      // A seller can sell…
      await sale(seller, [{ variantId: p.variants[0]!.id, quantity: 1 }]).expect(201);
      // …but cannot cancel.
      const denied = await seller.post(`/sales/${s.id}/cancel`).send({ reason: 'Quiero anular' }).expect(403);
      expect(denied.body.code).toBe('FORBIDDEN_ROLE');
      expect((await a.get(`/sales/${s.id}`).expect(200)).body.status).toBe('COMPLETED');
    });
  });

  // -------------------------------------------------------------------------
  describe('history and dashboard', () => {
    it('lists with filters and pagination, and summarizes today excluding canceled sales', async () => {
      const { a } = await newStore('historial');
      const p = await product(a, { salePrice: '50', variants: [{ size: 'M', quantity: 20 }] });
      const v = p.variants[0]!.id;
      await sale(a, [{ variantId: v, quantity: 1 }]).expect(201);
      await sale(a, [{ variantId: v, quantity: 2 }], { paymentMethod: 'QR' }).expect(201);
      const third = (await sale(a, [{ variantId: v, quantity: 3 }], { paymentMethod: 'TRANSFER' }).expect(201)).body;
      await a.post(`/sales/${third.id}/cancel`).send({ reason: 'Prueba de anulación' }).expect(200);

      const all = (await a.get('/sales?period=today').expect(200)).body;
      expect(all).toMatchObject({ total: 3, summary: { count: 2, total: '150.00' } });
      expect(all.items[0]).toMatchObject({ number: 'V-000003', status: 'CANCELED', unitCount: 3 });
      expect((await a.get('/sales?paymentMethod=QR').expect(200)).body.total).toBe(1);
      expect((await a.get('/sales?status=CANCELED').expect(200)).body.total).toBe(1);
      expect((await a.get('/sales?number=V-000002').expect(200)).body.items.map((s: { number: string }) => s.number)).toEqual(['V-000002']);
      expect((await a.get('/sales?number=2').expect(200)).body.total).toBe(1);
      expect((await a.get('/sales?period=yesterday').expect(200)).body.total).toBe(0);
      const page = (await a.get('/sales?pageSize=2&page=2').expect(200)).body;
      expect(page).toMatchObject({ total: 3, totalPages: 2, page: 2 });
      expect(page.items).toHaveLength(1);

      const summary = (await a.get('/dashboard/sales-summary').expect(200)).body;
      expect(summary.today).toEqual({ sales: 2, total: '150.00', units: 3 });
      expect(summary.recent).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------
  describe('isolation and subscription', () => {
    it('never exposes or sells another store’s products and sales', async () => {
      const A = await newStore('islaA');
      const B = await newStore('islaB');
      const pA = await product(A.a);
      const sA = (await sale(A.a, [{ variantId: pA.variants[0]!.id, quantity: 1 }]).expect(201)).body;

      await B.a.get(`/sales/${sA.id}`).expect(404);
      await B.a.get(`/sales/${sA.id}/receipt`).expect(404);
      await B.a.get(`/sales/${sA.id}/receipt/pdf`).expect(404);
      await B.a.post(`/sales/${sA.id}/cancel`).send({ reason: 'Ajena' }).expect(404);
      await B.a.post(`/sales/${sA.id}/receipt-link`).expect(404);
      expect((await sale(B.a, [{ variantId: pA.variants[0]!.id, quantity: 1 }]).expect(409)).body.code).toBe('PRODUCT_UNAVAILABLE');
      await B.a.post('/pos/preview').send({ items: [{ variantId: pA.variants[0]!.id, quantity: 1 }] }).expect(409);
      expect((await B.a.get('/sales').expect(200)).body.total).toBe(0);
      expect((await B.a.get('/pos/products?includeOutOfStock=true').expect(200)).body.total).toBe(0);
      expect(await stockOf(pA.variants[0]!.id)).toBe(4);
    });

    it('blocks new sales on an expired subscription but keeps history readable', async () => {
      const { a, tenantId } = await newStore('vencida');
      const p = await product(a);
      const s = (await sale(a, [{ variantId: p.variants[0]!.id, quantity: 1 }]).expect(201)).body;
      await prisma.subscription.update({ where: { tenantId }, data: { currentPeriodEnd: new Date(Date.now() - 1000) } });
      expect((await sale(a, [{ variantId: p.variants[0]!.id, quantity: 1 }]).expect(403)).body.code).toBe('SUBSCRIPTION_INACTIVE');
      await a.get('/sales').expect(200);
      await a.get(`/sales/${s.id}`).expect(200);
      await a.get(`/sales/${s.id}/receipt/pdf`).expect(200);
    });
  });
});
