import { allocateGeneralDiscount } from '../sales/sale-math.js';
import { averageTicketCents, centsToDecimal, decimalToCents, grossProfit, safeCellText, toKpis } from './report-math.js';

describe('report math (cents, no floats)', () => {
  it('parses PostgreSQL NUMERIC text exactly', () => {
    expect(decimalToCents('1234.50')).toBe(123450);
    expect(decimalToCents('1234.5')).toBe(123450);
    expect(decimalToCents('0.07')).toBe(7);
    expect(decimalToCents('-3.25')).toBe(-325);
    expect(decimalToCents(null)).toBe(0);
    expect(decimalToCents('0.1')).toBe(10);
    expect(centsToDecimal(-325)).toBe('-3.25');
  });

  it('average ticket rounds half up and is 0 without sales', () => {
    expect(averageTicketCents(10000, 3)).toBe(3333);
    expect(averageTicketCents(20000, 3)).toBe(6667);
    expect(averageTicketCents(0, 0)).toBe(0);
  });

  it('builds KPIs: discounts counted once (per-line + general)', () => {
    const k = toKpis({
      sales: 2,
      units: 3,
      total: '288.00',
      subtotal: '325.00',
      items_discount: '5.00',
      general_discount: '32.00',
      canceled_sales: 1,
      canceled_total: '85.00',
    });
    expect(k).toMatchObject({ sales: 2, units: 3, total: '288.00', discounts: '37.00', averageTicket: '144.00', canceled: { sales: 1, total: '85.00' } });
    expect(toKpis(undefined)).toMatchObject({ sales: 0, total: '0.00', averageTicket: '0.00', discounts: '0.00' });
  });

  it('gross profit never treats a missing cost as zero', () => {
    const complete = grossProfit(28800, { known_revenue: '288.00', known_cost: '160.00', units_without_cost: 0, revenue_without_cost: null });
    expect(complete).toMatchObject({ grossProfit: '128.00', complete: true, marginPct: 44.4 });
    const partial = grossProfit(28800, { known_revenue: '208.00', known_cost: '120.00', units_without_cost: 1, revenue_without_cost: '80.00' });
    expect(partial).toMatchObject({ revenue: '288.00', grossProfit: '88.00', complete: false, unitsWithoutCost: 1, revenueWithoutCost: '80.00' });
    const loss = grossProfit(5000, { known_revenue: '50.00', known_cost: '60.00', units_without_cost: 0, revenue_without_cost: null });
    expect(loss.grossProfit).toBe('-10.00');
    expect(grossProfit(0, undefined)).toMatchObject({ grossProfit: '0.00', marginPct: null, complete: true });
  });

  it('allocates the general discount so line nets add up to the total', () => {
    expect(allocateGeneralDiscount([8000, 24000], 3200)).toEqual([7200, 21600]);
    const nets = allocateGeneralDiscount([333, 333, 334], 100);
    expect(nets).toEqual([299, 300, 301]);
    expect(nets.reduce((a, b) => a + b, 0)).toBe(900);
    expect(allocateGeneralDiscount([1000, 500], 0)).toEqual([1000, 500]);
    expect(allocateGeneralDiscount([1, 1, 1], 2)).toEqual([0, 0, 1]);
  });

  it('neutralizes spreadsheet formulas in user text', () => {
    expect(safeCellText('=HYPERLINK("x")')).toBe(`'=HYPERLINK("x")`);
    expect(safeCellText('+1')).toBe("'+1");
    expect(safeCellText('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(safeCellText('Blusa roja')).toBe('Blusa roja');
    expect(safeCellText(null)).toBe('');
  });
});
