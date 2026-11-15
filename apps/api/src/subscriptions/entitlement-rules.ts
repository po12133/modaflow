/**
 * Pure subscription rules (no I/O), shared by EntitlementsService and future
 * modules (inventory, sales, AI, catalog). Kept free of Nest/Prisma so they
 * are trivially unit-testable.
 */
import type { CatalogAccess, SubscriptionStatus, UsagePeriod } from '../generated/prisma/enums.js';

export const DAY_MS = 24 * 60 * 60 * 1000;


export type FeatureKey = 'inventoryAndSales' | 'advancedReports' | 'onlineCatalog' | 'advancedManagement';
export type LimitKey = 'products' | 'aiAnalyses' | 'users' | 'branches';

export interface PlanRules {
  isTrial: boolean;
  maxProducts: number;
  aiAnalysesLimit: number;
  aiAnalysesPeriod: UsagePeriod;
  maxUsers: number;
  maxBranches: number;
  inventoryAndSales: boolean;
  advancedReports: boolean;
  onlineCatalog: CatalogAccess;
  advancedManagement: boolean;
}

export interface SubscriptionState {
  status: SubscriptionStatus;
  startedAt: Date;
  currentPeriodEnd: Date;
}

/** Status taking time into account: an elapsed period is EXPIRED even if not yet persisted. */
export function effectiveStatus(sub: SubscriptionState, now: Date): SubscriptionStatus {
  if (sub.status === 'CANCELED' || sub.status === 'EXPIRED' || sub.status === 'SUSPENDED') return sub.status;
  return now.getTime() >= sub.currentPeriodEnd.getTime() ? 'EXPIRED' : sub.status;
}

/** Whether the tenant may perform new business operations. */
export function isOperational(status: SubscriptionStatus): boolean {
  return status === 'TRIALING' || status === 'ACTIVE';
}

/** Whole days left, rounded up (13.2 days left => 14). Never negative. */
export function daysRemaining(periodEnd: Date, now: Date): number {
  const ms = periodEnd.getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / DAY_MS);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Date until which data must be kept after expiry (retention policy, informative for now). */
export function retentionUntil(periodEnd: Date, retentionDays: number): Date {
  return addDays(periodEnd, retentionDays);
}

export function isFeatureEnabled(plan: PlanRules, status: SubscriptionStatus, feature: FeatureKey): boolean {
  if (!isOperational(status)) return false;
  if (feature === 'onlineCatalog') {
    if (plan.onlineCatalog === 'FULL') return true;
    return plan.onlineCatalog === 'TEMPORARY' && status === 'TRIALING';
  }
  return plan[feature];
}

export function limitFor(plan: PlanRules, key: LimitKey): number {
  switch (key) {
    case 'products':
      return plan.maxProducts;
    case 'aiAnalyses':
      return plan.aiAnalysesLimit;
    case 'users':
      return plan.maxUsers;
    case 'branches':
      return plan.maxBranches;
  }
}

/** True when `increment` more units fit within `limit` given current `used`. */
export function fitsWithinLimit(limit: number, used: number, increment = 1): boolean {
  return used + increment <= limit;
}

export interface UsageWindow {
  start: Date;
  end: Date;
}

/**
 * Metering window for usage-based limits:
 * - TOTAL: the whole subscription period (trial: 10 analyses in total, never reset).
 * - MONTHLY: monthly cycles anchored on the subscription start date (a plan
 *   started on the 15th resets on the 15th of every month), so credits follow
 *   the subscription period rather than the calendar month.
 */
export function usageWindow(period: UsagePeriod, sub: SubscriptionState, now: Date): UsageWindow {
  if (period === 'TOTAL') {
    return { start: sub.startedAt, end: sub.currentPeriodEnd };
  }
  const start = sub.startedAt;
  let cycles = (now.getUTCFullYear() - start.getUTCFullYear()) * 12 + (now.getUTCMonth() - start.getUTCMonth());
  if (addMonths(start, cycles).getTime() > now.getTime()) cycles -= 1;
  cycles = Math.max(0, cycles);
  return { start: addMonths(start, cycles), end: addMonths(start, cycles + 1) };
}

/** Adds calendar months in UTC, clamping the day (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      y,
      m,
      Math.min(date.getUTCDate(), lastDay),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

export function contractedRules<T extends PlanRules>(sub: { plan: T; planVersion: PlanRules | null }): PlanRules {
  return sub.planVersion ?? sub.plan;
}
