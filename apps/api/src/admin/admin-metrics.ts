import { monthlyRecurringCents } from '../billing/billing-rules.js';
import type { BillingPeriod } from '../generated/prisma/enums.js';
import { fromCents } from '../sales/sale-math.js';

export interface PaidSubscriptionRow {
  billingPeriod: BillingPeriod;
  durationDays: number | null;
  priceCents: number;
}

export function mrrCents(rows: PaidSubscriptionRow[]): number {
  return rows.reduce((sum, r) => sum + monthlyRecurringCents(r), 0);
}

export function arpuCents(mrr: number, payingTenants: number): number | null {
  return payingTenants > 0 ? Math.round(mrr / payingTenants) : null;
}

export function conversionPct(converted: number, trials: number): number | null {
  return trials > 0 ? Math.round((converted / trials) * 1000) / 10 : null;
}

export function money(cents: number): string {
  return fromCents(cents);
}

export function numericCents(value: string | null | undefined): number {
  if (!value) return 0;
  const [int = '0', frac = ''] = value.split('.');
  return Number(int) * 100 + Number((frac + '00').slice(0, 2));
}
