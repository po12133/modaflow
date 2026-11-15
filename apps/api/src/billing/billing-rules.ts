import type { BillingPeriod, PeriodKind, SubscriptionStatus } from '../generated/prisma/enums.js';

const DAY_MS = 86_400_000;

export function addMonthsUtc(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(date.getUTCDate(), lastDay), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()));
}

export interface PeriodTerms {
  billingPeriod: BillingPeriod;
  durationDays: number | null;
}

export function periodEnd(start: Date, terms: PeriodTerms): Date {
  if (terms.billingPeriod === 'MONTHLY') return addMonthsUtc(start, 1);
  return new Date(start.getTime() + (terms.durationDays ?? 0) * DAY_MS);
}

export interface CurrentSubscription {
  status: SubscriptionStatus;
  planId: string;
  planIsTrial: boolean;
  currentPeriodEnd: Date;
}

export interface PlannedPeriod {
  kind: Exclude<PeriodKind, 'TRIAL' | 'EXTENSION'>;
  start: Date;
  end: Date;
}

export class BillingRuleError extends Error {
  constructor(
    readonly code: 'SUBSCRIPTION_SUSPENDED' | 'PLAN_NOT_PAYABLE' | 'INVALID_TRANSITION',
    message: string,
  ) {
    super(message);
  }
}

export function plannedPeriod(sub: CurrentSubscription, effective: SubscriptionStatus, targetPlanId: string, terms: PeriodTerms, now: Date): PlannedPeriod {
  if (effective === 'SUSPENDED') throw new BillingRuleError('SUBSCRIPTION_SUSPENDED', 'La suscripción está suspendida. Reactívala antes de registrar un pago.');
  const paidAndCurrent = effective === 'ACTIVE' && !sub.planIsTrial;
  if (paidAndCurrent && sub.planId === targetPlanId) {
    return { kind: 'RENEWAL', start: sub.currentPeriodEnd, end: periodEnd(sub.currentPeriodEnd, terms) };
  }
  return { kind: paidAndCurrent ? 'PLAN_CHANGE' : 'ACTIVATION', start: now, end: periodEnd(now, terms) };
}

export type AdminAction = 'SUSPEND' | 'REACTIVATE' | 'CANCEL' | 'EXTEND_TRIAL';

const ALLOWED: Record<AdminAction, SubscriptionStatus[]> = {
  SUSPEND: ['TRIALING', 'ACTIVE', 'EXPIRED'],
  REACTIVATE: ['SUSPENDED'],
  CANCEL: ['TRIALING', 'ACTIVE', 'EXPIRED', 'SUSPENDED'],
  EXTEND_TRIAL: ['TRIALING', 'EXPIRED'],
};

export function assertTransition(action: AdminAction, effective: SubscriptionStatus, planIsTrial = false): void {
  if (!ALLOWED[action].includes(effective) || (action === 'EXTEND_TRIAL' && !planIsTrial)) {
    throw new BillingRuleError('INVALID_TRANSITION', `No se puede ${ACTION_LABELS[action]} una suscripción en estado ${effective}.`);
  }
}

const ACTION_LABELS: Record<AdminAction, string> = {
  SUSPEND: 'suspender',
  REACTIVATE: 'reactivar',
  CANCEL: 'cancelar',
  EXTEND_TRIAL: 'extender la prueba de',
};

export function reactivatedStatus(previous: SubscriptionStatus | null, currentPeriodEnd: Date, now: Date): SubscriptionStatus {
  if (currentPeriodEnd.getTime() <= now.getTime()) return 'EXPIRED';
  return previous === 'TRIALING' ? 'TRIALING' : 'ACTIVE';
}

export function extendedTrialEnd(currentPeriodEnd: Date, days: number, now: Date): Date {
  return new Date(Math.max(currentPeriodEnd.getTime(), now.getTime()) + days * DAY_MS);
}

export function monthlyRecurringCents(terms: PeriodTerms & { priceCents: number }): number {
  if (terms.billingPeriod === 'MONTHLY') return terms.priceCents;
  if (!terms.durationDays) return 0;
  return Math.round((terms.priceCents * 30) / terms.durationDays);
}
