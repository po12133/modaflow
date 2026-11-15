import {
  cashChange,
  computeSale,
  discountAmount,
  formatSaleNumber,
  fromCents,
  parseSaleNumber,
  SaleRuleError,
  toCents,
} from './sale-math.js';

describe('money conversion', () => {
  it('parses decimal strings exactly', () => {
    expect(toCents('69')).toBe(6900);
    expect(toCents('69.5')).toBe(6950);
    expect(toCents('0,10')).toBe(10);
    expect(fromCents(6950)).toBe('69.50');
    expect(fromCents(5)).toBe('0.05');
  });

  it('rejects negatives, garbage and more than 2 decimals', () => {
    for (const bad of ['-1', 'abc', '1.234', '', '1e3']) expect(() => toCents(bad)).toThrow(SaleRuleError);
  });

  it('avoids floating point errors (0.1 + 0.2)', () => {
    const t = computeSale([
      { unitPriceCents: toCents('0.10'), quantity: 1 },
      { unitPriceCents: toCents('0.20'), quantity: 1 },
    ]);
    expect(fromCents(t.totalCents)).toBe('0.30');
  });
});

describe('computeSale', () => {
  it('applies the per-item discount (Bs 100 - Bs 10 = Bs 90)', () => {
    const t = computeSale([{ unitPriceCents: 10_000, quantity: 1, discount: { type: 'AMOUNT', value: '10' } }]);
    expect(t.lines[0]).toMatchObject({ unitDiscountCents: 1000, finalUnitPriceCents: 9000, lineTotalCents: 9000 });
    expect(t.totalCents).toBe(9000);
  });

  it('applies the general discount after item discounts (Bs 300 - 10% = Bs 270)', () => {
    const t = computeSale(
      [
        { unitPriceCents: 10_000, quantity: 2 },
        { unitPriceCents: 10_000, quantity: 1 },
      ],
      { type: 'PERCENT', value: '10' },
    );
    expect(t).toMatchObject({ subtotalCents: 30_000, itemsDiscountCents: 0, discountCents: 3000, totalCents: 27_000, units: 3 });
  });

  it('follows the order: line subtotals -> item discounts -> general discount', () => {
    const t = computeSale(
      [
        { unitPriceCents: 8500, quantity: 2, discount: { type: 'PERCENT', value: '10' } }, // 85 -> 76.50 x2 = 153.00
        { unitPriceCents: 12_000, quantity: 1 }, // 120.00
      ],
      { type: 'AMOUNT', value: '23' },
    );
    expect(t).toMatchObject({
      subtotalCents: 29_000,
      itemsDiscountCents: 1700,
      afterItemsCents: 27_300,
      discountCents: 2300,
      totalCents: 25_000,
    });
  });

  it('rounds percentages half-up to the centavo', () => {
    // 12.5% of Bs 33.33 = 4.16625 -> 4.17
    expect(discountAmount(3333, { type: 'PERCENT', value: '12.5' }, 'd')).toBe(417);
  });

  it('never allows discounts above the amount or totals below zero', () => {
    expect(() => computeSale([{ unitPriceCents: 5000, quantity: 1, discount: { type: 'AMOUNT', value: '50.01' } }])).toThrow(/mayor al importe/);
    expect(() => computeSale([{ unitPriceCents: 5000, quantity: 1 }], { type: 'PERCENT', value: '100.01' })).toThrow(/100 %/);
    expect(() => computeSale([{ unitPriceCents: 5000, quantity: 1 }], { type: 'AMOUNT', value: '60' })).toThrow(SaleRuleError);
    expect(() => computeSale([{ unitPriceCents: 5000, quantity: 1, discount: { type: 'AMOUNT', value: '-1' } }])).toThrow(SaleRuleError);
    const free = computeSale([{ unitPriceCents: 5000, quantity: 1 }], { type: 'PERCENT', value: '100' });
    expect(free.totalCents).toBe(0);
  });

  it('reports the field of the error', () => {
    try {
      computeSale([{ unitPriceCents: 100, quantity: 1 }, { unitPriceCents: 100, quantity: 0 }]);
    } catch (e) {
      expect((e as SaleRuleError).field).toBe('items.1.quantity');
    }
  });
});

describe('cash and numbering', () => {
  it('computes change and rejects insufficient cash', () => {
    expect(cashChange(8500, '100')).toEqual({ receivedCents: 10_000, changeCents: 1500 });
    expect(cashChange(8500, '')).toBeNull();
    expect(() => cashChange(8500, '80')).toThrow(/menor al total/);
  });

  it('formats and parses sale numbers', () => {
    expect(formatSaleNumber(1)).toBe('V-000001');
    expect(parseSaleNumber('V-000012')).toBe(12);
    expect(parseSaleNumber('v12')).toBe(12);
    expect(parseSaleNumber('abc')).toBeNull();
  });
});
