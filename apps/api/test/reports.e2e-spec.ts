// Stage 4 end-to-end tests: reports, statistics, plan restrictions and exports
// against a real PostgreSQL *_test database. Every expected number is also
// checked against the sales actually stored.
import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import ExcelJS from 'exceljs';
import request from 'supertest';
import type { Response as AgentResponse } from 'superagent';
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

function binary(res: AgentResponse, cb: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
}

const arrayBuffer = (body: unknown): ArrayBuffer => {
  const buf = body as Buffer;
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
};

describe('Reports (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let server: App;

  const agent = () => {
    const ip = `198.20.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;
    const a = request.agent(server);
    return {
      get: (url: string) => a.get(url).set('X-Forwarded-For', ip),
      file: (url: string) => a.get(url).set('X-Forwarded-For', ip).buffer(true).parse(binary),
      post: (url: string) => a.post(url).set('X-Forwarded-For', ip),
      patch: (url: string) => a.patch(url).set('X-Forwarded-For', ip),
    };
  };
  type Agent = ReturnType<typeof agent>;

  async function newStore(name: string) {
    const a = agent();
    const email = `${name}.${run}.${ipCounter}@e2e.test`;
    await a.post('/auth/register').send({ name: `${name} Pérez`, email, password: PASSWORD }).expect(201);
    const res = await a
      .post('/onboarding')
      .send({ name: `Tienda ${name}`, whatsapp: `6${Math.floor(1_000_000 + Math.random() * 8_999_999)}`, city: 'La Paz', primaryColor: '#FF5C8A' })
      .expect(201);
    const cats = (await a.get('/categories').expect(200)).body as { id: string; name: string }[];
    return { a, tenantId: res.body.tenantId as string, cat: (n: string) => cats.find((c) => c.name === n)!.id };
  }

  async function product(a: Agent, body: Record<string, unknown>) {
    const res = await a.post('/products').send(body).expect(201);
    return res.body as { id: string; variants: { id: string; size: string | null }[] };
  }

  const sale = async (a: Agent, items: { variantId: string; quantity: number; discount?: unknown }[], extra: Record<string, unknown> = {}) =>
    (await a.post('/sales').send({ items, paymentMethod: 'CASH', paymentConfirmed: true, idempotencyKey: key(), ...extra }).expect(201)).body as {
      id: string;
      number: string;
    };

  const dbTotals = async (tenantId: string, gte: Date, lt: Date) => {
    const agg = await prisma.sale.aggregate({
      where: { tenantId, status: 'COMPLETED', createdAt: { gte, lt } },
      _count: true,
      _sum: { total: true, unitCount: true },
    });
    return { sales: agg._count, total: (agg._sum.total ?? 0).toString(), units: agg._sum.unitCount ?? 0 };
  };

  async function setPlan(tenantId: string, code: string) {
    const plan = await prisma.plan.findUniqueOrThrow({ where: { code } });
    await prisma.subscription.update({ where: { tenantId }, data: { planId: plan.id, planVersionId: (await prisma.planVersion.findFirstOrThrow({ where: { planId: plan.id }, orderBy: { version: 'desc' } })).id, status: 'ACTIVE' } });
  }

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
  it('reports without sales show zeros and no base for comparison', async () => {
    const { a } = await newStore('vacio');
    const s = (await a.get('/reports/summary?period=today').expect(200)).body;
    expect(s.kpis).toMatchObject({ sales: 0, units: 0, total: '0.00', averageTicket: '0.00', discounts: '0.00' });
    expect(s.comparison.changes).toEqual({ total: null, sales: null, units: null, averageTicket: null });
    expect(s.profit).toMatchObject({ grossProfit: '0.00', complete: true, marginPct: null });
    const chart = (await a.get('/reports/sales-chart?period=this_week').expect(200)).body;
    expect(chart.points).toHaveLength(7);
    expect(chart.points.every((p: { total: string | null }) => p.total === null || p.total === '0.00')).toBe(true);
    expect((await a.get('/reports/products').expect(200)).body).toMatchObject({ items: [], total: 0 });
    expect((await a.get('/reports/payment-methods').expect(200)).body.items).toEqual([]);
    const dash = (await a.get('/dashboard/sales-summary').expect(200)).body;
    expect(dash).toMatchObject({ today: { sales: 0, total: '0.00', units: 0 }, month: { sales: 0 }, recent: [], lowStock: { total: 0 } });
  });

  // -------------------------------------------------------------------------
  describe('a store with sales', () => {
    let store: Awaited<ReturnType<typeof newStore>>;
    let blusa: Awaited<ReturnType<typeof product>>;
    let vestido: Awaited<ReturnType<typeof product>>;
    let unico: Awaited<ReturnType<typeof product>>;
    let s1: { id: string; number: string };
    let s2: { id: string; number: string };
    let s3: { id: string; number: string };

    beforeAll(async () => {
      store = await newStore('ventas');
      const { a, cat } = store;
      blusa = await product(a, {
        name: 'Blusa estampada',
        salePrice: '100',
        purchasePrice: '40',
        categoryId: cat('Blusas'),
        variants: [{ size: 'S', quantity: 5 }, { size: 'M', quantity: 5 }],
      });
      vestido = await product(a, { name: '=Vestido sin costo', salePrice: '85', categoryId: cat('Vestidos'), variants: [{ quantity: 3 }] });
      unico = await product(a, { name: 'Chaqueta vintage única', salePrice: '150', purchasePrice: '60', variants: [{ quantity: 1 }] });
      // s1: 2 blusas -10 % + 1 vestido, general discount Bs 26.50 → 265 − 26.50 = 238.50
      s1 = await sale(
        a,
        [
          { variantId: blusa.variants[0]!.id, quantity: 2, discount: { type: 'PERCENT', value: '10' } },
          { variantId: vestido.variants[0]!.id, quantity: 1 },
        ],
        { discount: { type: 'AMOUNT', value: '26.50' } },
      );
      s2 = await sale(a, [{ variantId: blusa.variants[1]!.id, quantity: 1 }], { paymentMethod: 'QR' });
      s3 = await sale(a, [{ variantId: vestido.variants[0]!.id, quantity: 1 }], { paymentMethod: 'TRANSFER' });
      await a.post(`/sales/${s3.id}/cancel`).send({ reason: 'Cliente arrepentida', idempotencyKey: key() }).expect(200);
    });

    it('totals, units, discounts and average ticket match the stored sales (canceled excluded)', async () => {
      const r = (await store.a.get('/reports/summary?period=today').expect(200)).body;
      expect(r.kpis).toEqual({
        sales: 2,
        units: 4,
        total: '338.50',
        subtotal: '385.00',
        itemsDiscount: '20.00',
        generalDiscount: '26.50',
        discounts: '46.50',
        averageTicket: '169.25',
        canceled: { sales: 1, total: '85.00' },
      });
      const db = await dbTotals(store.tenantId, new Date(r.period.start), new Date(r.period.end));
      expect(db).toEqual({ sales: 2, total: '338.5', units: 4 });
      // Line nets (after the general discount) add up exactly to each sale total.
      for (const id of [s1.id, s2.id]) {
        const [row] = await prisma.$queryRaw<{ ok: boolean }[]>`
          SELECT (SELECT total FROM sales WHERE id = ${id}::uuid) = sum(net_total) AS ok FROM sale_items WHERE sale_id = ${id}::uuid`;
        expect(row!.ok).toBe(true);
      }
    });

    it('estimates gross profit with historical costs and flags missing costs', async () => {
      const r = (await store.a.get('/reports/summary?period=today').expect(200)).body;
      // Blusas: nets 162.00 + 100.00, cost 3 × 40. Vestido (no cost): net 76.50 left out.
      expect(r.profit).toEqual({
        revenue: '338.50',
        knownRevenue: '262.00',
        knownCost: '120.00',
        grossProfit: '142.00',
        marginPct: 54.2,
        unitsWithoutCost: 1,
        revenueWithoutCost: '76.50',
        complete: false,
      });

      // A later purchase price change never rewrites past sales…
      await store.a.patch(`/products/${blusa.id}`).send({ purchasePrice: '50' }).expect(200);
      const same = (await store.a.get('/reports/summary?period=today').expect(200)).body;
      expect(same.profit.knownCost).toBe('120.00');
      const items = await prisma.saleItem.findMany({ where: { saleId: { in: [s1.id, s2.id] }, productId: blusa.id } });
      expect(items.map((i) => i.unitCost?.toFixed(2))).toEqual(['40.00', '40.00']);
      // …and new sales use the new cost.
      const s4 = await sale(store.a, [{ variantId: blusa.variants[0]!.id, quantity: 1 }]);
      const after = (await store.a.get('/reports/summary?period=today').expect(200)).body;
      expect(after.profit).toMatchObject({ knownRevenue: '362.00', knownCost: '170.00', grossProfit: '192.00' });
      // Undo s4 so the next assertions keep the original numbers.
      await store.a.post(`/sales/${s4.id}/cancel`).send({ reason: 'Prueba de costo', idempotencyKey: key() }).expect(200);
    });

    it('ranks products by historical sales, with categories, variants and payment methods', async () => {
      const { a, cat } = store;
      const byUnits = (await a.get('/reports/products?period=today').expect(200)).body;
      expect(byUnits.items.map((x: { name: string; units: number; revenue: string }) => [x.name, x.units, x.revenue])).toEqual([
        ['Blusa estampada', 3, '262.00'],
        ['=Vestido sin costo', 1, '76.50'],
      ]);
      expect(byUnits.items[0].profit).toMatchObject({ grossProfit: '142.00', complete: true });
      expect(byUnits.items[1].profit).toMatchObject({ complete: false, unitsWithoutCost: 1 });
      const least = (await a.get('/reports/products?period=today&sort=units_asc').expect(200)).body;
      expect(least.items[0].name).toBe('=Vestido sin costo');
      const filtered = (await a.get(`/reports/products?period=today&categoryId=${cat('Vestidos')}`).expect(200)).body;
      expect(filtered.items.map((x: { name: string }) => x.name)).toEqual(['=Vestido sin costo']);
      expect(byUnits.variants[0]).toMatchObject({ size: 'S', units: 2 });
      expect(byUnits.categories.map((c: { name: string; revenue: string }) => [c.name, c.revenue])).toEqual([
        ['Blusas', '262.00'],
        ['Vestidos', '76.50'],
      ]);
      const methods = (await a.get('/reports/payment-methods?period=today').expect(200)).body.items;
      expect(methods).toEqual([
        { method: 'CASH', sales: 1, total: '238.50' },
        { method: 'QR', sales: 1, total: '100.00' },
      ]);
      const chart = (await a.get('/reports/sales-chart?period=today').expect(200)).body;
      expect(chart.granularity).toBe('hour');
      expect(chart.points).toHaveLength(24);
      const chartTotal = chart.points.reduce((s: number, p: { total: string | null }) => s + Math.round(Number(p.total ?? 0) * 100), 0);
      expect(chartTotal).toBe(33850);
    });

    it('sales report: paginated table, filters and KPIs with the same filters', async () => {
      const { a } = store;
      const page1 = (await a.get('/reports/sales?period=today&pageSize=2').expect(200)).body;
      expect(page1.total).toBe(4); // s1, s2, s3 (canceled) and s4 (canceled)
      expect(page1.items).toHaveLength(2);
      expect(page1.totalPages).toBe(2);
      const asc = (await a.get('/reports/sales?period=today&sort=asc').expect(200)).body;
      expect(asc.items[0].number).toBe(s1.number);
      expect(asc.items[0]).toMatchObject({ units: 3, subtotal: '285.00', discounts: '46.50', total: '238.50', paymentMethod: 'CASH', status: 'COMPLETED' });
      const qr = (await a.get('/reports/sales?period=today&paymentMethod=QR').expect(200)).body;
      expect(qr.kpis).toMatchObject({ sales: 1, total: '100.00' });
      const canceled = (await a.get('/reports/sales?period=today&status=CANCELED').expect(200)).body;
      expect(canceled.items.map((x: { number: string }) => x.number)).toContain(s3.number);
      const byNumber = (await a.get(`/reports/sales?period=today&number=${s2.number}`).expect(200)).body;
      expect(byNumber.items.map((x: { id: string }) => x.id)).toEqual([s2.id]);
      expect(page1.sellers).toHaveLength(1);
    });

    it('inventory report: stock, low stock, value and movements', async () => {
      const { a } = store;
      const inv = (await a.get('/reports/inventory?period=today').expect(200)).body;
      // Blusa 10 − 3 = 7 (s4 restocked), vestido 3 − 1 = 2 (s3 restocked), chaqueta 1.
      expect(inv.stock).toEqual({ activeProducts: 3, units: 10, outOfStock: 0 });
      // Vestido (2 ≤ default threshold 2) is low; the one-off jacket is normal.
      expect(inv.lowStock.items.map((x: { name: string }) => x.name)).toEqual(['=Vestido sin costo']);
      expect(inv.lowStock.uniqueExcluded).toBe(1);
      const withUnique = (await a.get('/reports/inventory?period=today&includeUnique=true').expect(200)).body;
      expect(withUnique.lowStock.items.map((x: { name: string }) => x.name)).toEqual(['Chaqueta vintage única', '=Vestido sin costo']);
      const t1 = (await a.get('/reports/inventory?period=today&lowStock=1').expect(200)).body;
      expect(t1.lowStock.total).toBe(0);
      // Cost value: blusa 7 × 50 + chaqueta 1 × 60; vestido has no cost (2 units).
      expect(inv.value).toEqual({ costValue: '410.00', retailValue: '1020.00', unitsWithoutCost: 2, productsWithoutCost: 1, complete: false });
      const mv = Object.fromEntries(inv.movements.map((m: { type: string; units: number }) => [m.type, m.units]));
      expect(mv).toMatchObject({ INITIAL: 14, SALE: 6, SALE_CANCEL: 2 });
    });

    it('filters by day, week, fortnight and month boundaries in the store time zone', async () => {
      const { a, tenantId } = store;
      const month = (await a.get('/reports/summary?period=this_month').expect(200)).body.period;
      // Move s2 to the last second of the previous month (local time).
      await prisma.sale.update({ where: { id: s2.id }, data: { createdAt: new Date(new Date(month.start).getTime() - 1000) } });
      const thisMonth = (await a.get('/reports/summary?period=this_month').expect(200)).body;
      const lastMonth = (await a.get('/reports/summary?period=last_month').expect(200)).body;
      expect(thisMonth.kpis.total).toBe('238.50');
      expect(lastMonth.kpis.total).toBe('100.00');
      expect(await dbTotals(tenantId, new Date(thisMonth.period.start), new Date(thisMonth.period.end))).toMatchObject({ total: '238.5' });

      // Exactly at the start of the month → this month (inclusive lower bound).
      await prisma.sale.update({ where: { id: s2.id }, data: { createdAt: new Date(month.start) } });
      expect((await a.get('/reports/summary?period=this_month').expect(200)).body.kpis.total).toBe('338.50');

      for (const period of ['this_week', 'this_fortnight', 'today'] as const) {
        const p = (await a.get(`/reports/summary?period=${period}`).expect(200)).body.period;
        await prisma.sale.update({ where: { id: s2.id }, data: { createdAt: new Date(p.start) } });
        expect((await a.get(`/reports/summary?period=${period}`).expect(200)).body.kpis.sales).toBe(2);
        await prisma.sale.update({ where: { id: s2.id }, data: { createdAt: new Date(new Date(p.start).getTime() - 1) } });
        expect((await a.get(`/reports/summary?period=${period}`).expect(200)).body.kpis.sales).toBe(1);
      }

      // Custom range (inclusive "to" day) and validation.
      const today = (await a.get('/reports/summary?period=today').expect(200)).body.period;
      const custom = (await a.get(`/reports/summary?period=custom&from=${today.from}&to=${today.to}`).expect(200)).body;
      expect(custom.kpis.sales).toBe(1);
      const bad = await a.get(`/reports/summary?period=custom&from=2026-11-10&to=2026-11-01`).expect(400);
      expect(bad.body.errors.from[0]).toMatch(/posterior/);

      // Comparison: s2 in the previous month inside the same elapsed window.
      await prisma.sale.update({ where: { id: s2.id }, data: { createdAt: new Date(thisMonth.period.previous.start) } });
      const cmp = (await a.get('/reports/summary?period=this_month').expect(200)).body.comparison;
      expect(cmp.previous.kpis).toMatchObject({ sales: 1, total: '100.00' });
      expect(cmp.changes).toMatchObject({ total: 138.5, sales: 0, units: 200 });
      await prisma.sale.update({ where: { id: s2.id }, data: { createdAt: new Date() } });
    });

    it('exports Excel with numeric amounts, totals and formula-safe text', async () => {
      const { a } = store;
      const res = await a.file('/reports/export/excel?period=today&report=sales').expect(200);
      expect(res.headers['content-type']).toContain('spreadsheetml');
      expect(res.headers['content-disposition']).toMatch(/attachment; filename="modaflow-sales-/);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(arrayBuffer(res.body));
      const summary = wb.getWorksheet('Resumen')!;
      expect(summary.getCell('A1').text).toContain('Tienda ventas');
      const totalRow = summary.getRows(1, summary.rowCount)!.find((r) => r.getCell(1).value === 'Total vendido')!;
      expect(totalRow.getCell(2).value).toBe(338.5);
      const sales = wb.getWorksheet('Ventas')!;
      const rows = sales.getRows(1, sales.rowCount)!.filter((r) => typeof r.getCell(2).value === 'string' && /^V-\d{6}$/.test(r.getCell(2).value as string));
      expect(rows).toHaveLength(4);
      expect(rows[0]!.getCell(1).value).toBeInstanceOf(Date);
      expect(typeof rows[0]!.getCell(6).value).toBe('number');
      const last = sales.getRow(sales.rowCount);
      expect(last.getCell(1).value).toBe('Total (sin anuladas)');
      expect(last.getCell(6).value).toBe(338.5);

      const prod = await a.file('/reports/export/excel?period=today&report=products').expect(200);
      const wb2 = new ExcelJS.Workbook();
      await wb2.xlsx.load(arrayBuffer(prod.body));
      const names = wb2.getWorksheet('Productos')!.getColumn(1).values as unknown[];
      expect(names).toContain("'=Vestido sin costo");
      expect(names).not.toContain('=Vestido sin costo');

      for (const report of ['summary', 'inventory']) {
        const r = await a.file(`/reports/export/excel?period=this_month&report=${report}`).expect(200);
        await new ExcelJS.Workbook().xlsx.load(arrayBuffer(r.body));
      }
    });

    it('exports paginated PDFs', async () => {
      for (const report of ['summary', 'sales', 'products', 'inventory']) {
        const res = await store.a.file(`/reports/export/pdf?period=today&report=${report}`).expect(200);
        expect(res.headers['content-type']).toBe('application/pdf');
        const body = res.body as Buffer;
        expect(body.subarray(0, 5).toString()).toBe('%PDF-');
        expect(body.length).toBeGreaterThan(1500);
      }
    });

    it('dashboard shows today, month and low stock', async () => {
      const dash = (await store.a.get('/dashboard/sales-summary').expect(200)).body;
      expect(dash.today).toEqual({ sales: 2, total: '338.50', units: 4 });
      expect(dash.month).toMatchObject({ sales: 2, total: '338.50' });
      expect(dash.lowStock.total).toBe(1);
      expect(dash.recent.length).toBeGreaterThanOrEqual(4);
    });

    it('isolation: another store sees none of this data and cannot filter by its ids', async () => {
      const other = await newStore('ajena');
      const s = (await other.a.get('/reports/summary?period=today').expect(200)).body;
      expect(s.kpis.sales).toBe(0);
      const p = (await other.a.get(`/reports/products?period=today&productId=${blusa.id}`).expect(200)).body;
      expect(p.items).toEqual([]);
      const t = (await other.a.get(`/reports/sales?period=today&number=${s1.number}`).expect(200)).body;
      expect(t.items).toEqual([]);
      const xlsx = await other.a.file('/reports/export/excel?period=today&report=sales').expect(200);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(arrayBuffer(xlsx.body));
      expect(wb.getWorksheet('Resumen')!.getCell('A1').text).toContain('Tienda ajena');
      expect(wb.getWorksheet('Ventas')!.getRow(wb.getWorksheet('Ventas')!.rowCount).getCell(6).value).toBe(0);
      expect(unico.id).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  describe('plans and roles', () => {
    it('Básico gets basic reports only; the API rejects advanced ones', async () => {
      const { a, tenantId } = await newStore('basico');
      const p = await product(a, { name: 'Polera', salePrice: '50', purchasePrice: '20', variants: [{ quantity: 4 }] });
      await sale(a, [{ variantId: p.variants[0]!.id, quantity: 2 }]);
      await setPlan(tenantId, 'basico');

      const s = (await a.get('/reports/summary?period=today').expect(200)).body;
      expect(s.kpis).toMatchObject({ sales: 1, total: '100.00' });
      expect(s.profit).toBeNull();
      expect(s.comparison).toBeNull();
      expect(s.access).toMatchObject({ advanced: false, plan: 'Básico' });
      await a.get('/reports/sales?period=today').expect(200);
      const inv = (await a.get('/reports/inventory').expect(200)).body;
      expect(inv.value).toBeNull();
      expect(inv.movements).toBeNull();
      for (const url of ['/reports/products', '/reports/sales-chart', '/reports/categories', '/reports/payment-methods', '/reports/export/excel', '/reports/export/pdf']) {
        const denied = await a.get(url).expect(403);
        expect(denied.body.code).toBe('FEATURE_NOT_IN_PLAN');
      }

      await setPlan(tenantId, 'pro');
      await a.get('/reports/products').expect(200);
      expect((await a.get('/reports/summary?period=today').expect(200)).body.profit.grossProfit).toBe('60.00');

      // Expired: basic reports stay readable, advanced ones are blocked.
      await prisma.subscription.update({ where: { tenantId }, data: { currentPeriodEnd: new Date(Date.now() - 1000) } });
      expect((await a.get('/reports/summary?period=today').expect(200)).body.kpis.total).toBe('100.00');
      expect((await a.get('/reports/products').expect(403)).body.code).toBe('SUBSCRIPTION_INACTIVE');
      expect((await a.get('/reports/export/excel').expect(403)).body.code).toBe('SUBSCRIPTION_INACTIVE');
    });

    it('sellers cannot read reports or exports', async () => {
      const { tenantId } = await newStore('rol');
      const email = `vendedora.rep.${run}.${ipCounter}@e2e.test`;
      const passwordHash = await app.get(PasswordService).hash(PASSWORD);
      const user = await prisma.user.create({ data: { name: 'Vendedora', email, passwordHash } });
      await prisma.tenantMembership.create({ data: { tenantId, userId: user.id, role: 'SELLER' } });
      const seller = agent();
      await seller.post('/auth/login').send({ email, password: PASSWORD }).expect(200);
      expect((await seller.get('/reports/summary').expect(403)).body.code).toBe('FORBIDDEN_ROLE');
      expect((await seller.get('/reports/export/pdf').expect(403)).body.code).toBe('FORBIDDEN_ROLE');
      await seller.get('/dashboard/sales-summary').expect(200);
    });
  });

  // -------------------------------------------------------------------------
  it('handles large volumes with aggregated queries and streamed exports', async () => {
    const { a, tenantId } = await newStore('volumen');
    const p = await product(a, { name: 'Blusa básica', salePrice: '50', purchasePrice: '20', variants: [{ size: 'M', quantity: 10 }] });
    const store = await prisma.store.findFirstOrThrow({ where: { tenantId } });
    const seller = await prisma.tenantMembership.findFirstOrThrow({ where: { tenantId } });
    const N = 20_000;
    // Synthetic sales spread over the last 25 days (performance fixture only).
    await prisma.$executeRaw`
      WITH s AS (
        INSERT INTO sales (id, tenant_id, store_id, number, seller_id, subtotal, items_discount, discount_amount, total, unit_count,
                           payment_method, payment_confirmed, status, idempotency_key, created_at, updated_at)
        SELECT gen_random_uuid(), ${tenantId}::uuid, ${store.id}::uuid, 1000 + g, ${seller.userId}::uuid, 50, 0, 0, 50, 1,
               (ARRAY['CASH','QR','TRANSFER','OTHER']::"PaymentMethod"[])[1 + g % 4], true, 'COMPLETED', 'vol' || g,
               now() - (g % 600) * interval '1 hour', now()
        FROM generate_series(1, ${N}::int) AS g
        RETURNING id
      )
      INSERT INTO sale_items (id, sale_id, tenant_id, product_id, variant_id, position, product_name, sku, quantity,
                              unit_price, unit_discount, final_unit_price, line_total, net_total, unit_cost)
      SELECT gen_random_uuid(), s.id, ${tenantId}::uuid, ${p.id}::uuid, ${p.variants[0]!.id}::uuid, 0, 'Blusa básica', 'P00001-M', 1,
             50, 0, 50, 50, 50, 20
      FROM s`;
    // A bulk insert leaves planner statistics stale until autovacuum runs; real
    // stores grow gradually, so refresh them like autovacuum would.
    await prisma.$executeRawUnsafe('ANALYZE sales, sale_items');

    const timed = async (url: string) => {
      const t = Date.now();
      const res = await a.get(url).expect(200);
      return { body: res.body, ms: Date.now() - t };
    };
    const summary = await timed('/reports/summary?period=last30');
    expect(summary.body.kpis).toMatchObject({ sales: N, total: '1000000.00', units: N });
    expect(summary.body.profit.grossProfit).toBe('600000.00');
    const others = await Promise.all(['/reports/sales-chart?period=last30', '/reports/products?period=last30', '/reports/sales?period=last30&page=50', '/reports/payment-methods?period=last30'].map(timed));
    for (const r of [summary, ...others]) expect(r.ms).toBeLessThan(3000);
    expect(others[2]!.body.items).toHaveLength(20);

    const t = Date.now();
    const xlsx = await a.file('/reports/export/excel?period=last30&report=sales').expect(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arrayBuffer(xlsx.body));
    const ws = wb.getWorksheet('Ventas')!;
    expect(ws.getRow(ws.rowCount).getCell(6).value).toBe(1_000_000);
    expect(Date.now() - t).toBeLessThan(30_000);
    const pdf = await a.file('/reports/export/pdf?period=last30&report=sales').expect(200);
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
  }, 120_000);
});
