/**
 * Pure subscription rules (no I/O), shared by EntitlementsService and future
 * modules (inventory, sales, AI, catalog). Kept free of Nest/Prisma so they
 * are trivially unit-testable.
 */
import type { CatalogAccess, SubscriptionStatus, UsagePeriod } from '../generated/prisma/enums.js';

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Business timezone: Bolivia (America/La_Paz) is UTC-4 all year, no DST. */
export const BUSINESS_UTC_OFFSET_HOURS = -4;

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
  if (sub.status === 'CANCELED' || sub.status === 'EXPIRED') return sub.status;
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
 * - TOTAL: the whole subscription period (trial: 10 analyses in total).
 * - MONTHLY: the current calendar month in the business timezone.
 */
export function usageWindow(period: UsagePeriod, sub: SubscriptionState, now: Date): UsageWindow {
  if (period === 'TOTAL') {
    return { start: sub.startedAt, end: sub.currentPeriodEnd };
  }
  const offsetMs = BUSINESS_UTC_OFFSET_HOURS * 60 * 60 * 1000;
  const local = new Date(now.getTime() + offsetMs);
  const startLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1);
  const endLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1);
  return { start: new Date(startLocal - offsetMs), end: new Date(endLocal - offsetMs) };
}
