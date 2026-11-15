import { fromCents } from '../sales/sale-math.js';

export function decimalToCents(value: string | null | undefined): number {
  if (value == null || value === '') return 0;
  const negative = value.startsWith('-');
  const [int = '0', frac = ''] = value.replace('-', '').split('.');
  const cents = Number(int) * 100 + Number((frac + '00').slice(0, 2));
  return negative ? -cents : cents;
}

export function centsToDecimal(cents: number): string {
  return cents < 0 ? `-${fromCents(-cents)}` : fromCents(cents);
}

export function averageTicketCents(totalCents: number, sales: number): number {
  return sales > 0 ? Math.round(totalCents / sales) : 0;
}

export interface KpiRow {
  sales: number;
  units: number;
  total: string | null;
  subtotal: string | null;
  items_discount: string | null;
  general_discount: string | null;
  canceled_sales: number;
  canceled_total: string | null;
}

export interface Kpis {
  sales: number;
  units: number;
  total: string;
  subtotal: string;
  itemsDiscount: string;
  generalDiscount: string;
  discounts: string;
  averageTicket: string;
  canceled: { sales: number; total: string };
}

export function toKpis(row: KpiRow | undefined): Kpis {
  const totalCents = decimalToCents(row?.total);
  const items = decimalToCents(row?.items_discount);
  const general = decimalToCents(row?.general_discount);
  const sales = row?.sales ?? 0;
  return {
    sales,
    units: row?.units ?? 0,
    total: fromCents(totalCents),
    subtotal: fromCents(decimalToCents(row?.subtotal)),
    itemsDiscount: fromCents(items),
    generalDiscount: fromCents(general),
    discounts: fromCents(items + general),
    averageTicket: fromCents(averageTicketCents(totalCents, sales)),
    canceled: { sales: row?.canceled_sales ?? 0, total: fromCents(decimalToCents(row?.canceled_total)) },
  };
}

export interface CostRow {
  known_revenue: string | null;
  known_cost: string | null;
  units_without_cost: number;
  revenue_without_cost: string | null;
}

export interface GrossProfit {
  revenue: string;
  knownRevenue: string;
  knownCost: string;
  grossProfit: string;
  marginPct: number | null;
  unitsWithoutCost: number;
  revenueWithoutCost: string;
  complete: boolean;
}

export function grossProfit(revenueCents: number, row: CostRow | undefined): GrossProfit {
  const knownRevenue = decimalToCents(row?.known_revenue);
  const knownCost = decimalToCents(row?.known_cost);
  const unitsWithoutCost = row?.units_without_cost ?? 0;
  const profit = knownRevenue - knownCost;
  return {
    revenue: fromCents(revenueCents),
    knownRevenue: fromCents(knownRevenue),
    knownCost: fromCents(knownCost),
    grossProfit: centsToDecimal(profit),
    marginPct: knownRevenue > 0 ? Math.round((profit / knownRevenue) * 1000) / 10 : null,
    unitsWithoutCost,
    revenueWithoutCost: fromCents(decimalToCents(row?.revenue_without_cost)),
    complete: unitsWithoutCost === 0,
  };
}

export function safeCellText(value: string | null | undefined): string {
  if (!value) return '';
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
