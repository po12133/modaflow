import { PLAN_CATALOG } from '../plans/plan-catalog.js';
import {
  addDays,
  daysRemaining,
  effectiveStatus,
  fitsWithinLimit,
  isFeatureEnabled,
  isOperational,
  limitFor,
  type PlanRules,
  retentionUntil,
  usageWindow,
} from './entitlement-rules.js';

const plan = (code: string): PlanRules => {
  const found = PLAN_CATALOG.find((p) => p.code === code);
  if (!found) throw new Error(`no plan ${code}`);
  return found;
};

const start = new Date('2026-11-01T12:00:00.000Z');
const trial = { status: 'TRIALING' as const, startedAt: start, currentPeriodEnd: addDays(start, 14) };

describe('plan catalog', () => {
  it('has exactly gratis, basico, pro and premium (no Empresarial)', () => {
    expect(PLAN_CATALOG.map((p) => p.code)).toEqual(['gratis', 'basico', 'pro', 'premium']);
  });

  it('marks only Pro as recommended and only Gratis as a 14-day trial', () => {
    expect(PLAN_CATALOG.filter((p) => p.isRecommended).map((p) => p.code)).toEqual(['pro']);
    expect(PLAN_CATALOG.filter((p) => p.isTrial).map((p) => [p.code, p.durationDays])).toEqual([['gratis', 14]]);
  });

  it('matches the commercial limits table', () => {
    const rows = PLAN_CATALOG.map((p) => [p.code, p.priceCents, p.maxProducts, p.aiAnalysesLimit, p.maxUsers, p.maxBranches]);
    expect(rows).toEqual([
      ['gratis', 0, 30, 10, 1, 1],
      ['basico', 3000, 150, 20, 1, 1],
      ['pro', 6900, 1000, 100, 3, 1],
      ['premium', 11900, 5000, 300, 10, 3],
    ]);
    expect(plan('gratis').aiAnalysesPeriod).toBe('TOTAL');
    expect(plan('basico').aiAnalysesPeriod).toBe('MONTHLY');
  });
});

describe('effectiveStatus / isOperational', () => {
  it('keeps TRIALING before the end of the period', () => {
    expect(effectiveStatus(trial, addDays(start, 13.9))).toBe('TRIALING');
    expect(isOperational('TRIALING')).toBe(true);
  });

  it('becomes EXPIRED exactly at the end of the period', () => {
    expect(effectiveStatus(trial, addDays(start, 14))).toBe('EXPIRED');
    expect(isOperational('EXPIRED')).toBe(false);
  });

  it('never revives a canceled subscription', () => {
    expect(effectiveStatus({ ...trial, status: 'CANCELED' }, start)).toBe('CANCELED');
  });
});

describe('daysRemaining', () => {
  it('is 14 right after the trial starts', () => {
    expect(daysRemaining(trial.currentPeriodEnd, start)).toBe(14);
  });

  it('rounds partial days up', () => {
    expect(daysRemaining(trial.currentPeriodEnd, addDays(start, 13.5))).toBe(1);
  });

  it('is 0 once expired, never negative', () => {
    expect(daysRemaining(trial.currentPeriodEnd, addDays(start, 20))).toBe(0);
  });
});

describe('retentionUntil', () => {
  it('keeps data 30 days after expiry', () => {
    expect(retentionUntil(trial.currentPeriodEnd, 30).toISOString()).toBe(addDays(start, 44).toISOString());
  });
});

describe('isFeatureEnabled', () => {
  it('trial includes advanced reports and a temporary catalog', () => {
    expect(isFeatureEnabled(plan('gratis'), 'TRIALING', 'advancedReports')).toBe(true);
    expect(isFeatureEnabled(plan('gratis'), 'TRIALING', 'onlineCatalog')).toBe(true);
    expect(isFeatureEnabled(plan('gratis'), 'TRIALING', 'advancedManagement')).toBe(false);
  });

  it('disables the temporary catalog and everything else once the trial expires', () => {
    expect(isFeatureEnabled(plan('gratis'), 'EXPIRED', 'onlineCatalog')).toBe(false);
    expect(isFeatureEnabled(plan('gratis'), 'EXPIRED', 'inventoryAndSales')).toBe(false);
  });

  it('Básico has no catalog and no advanced reports', () => {
    expect(isFeatureEnabled(plan('basico'), 'ACTIVE', 'onlineCatalog')).toBe(false);
    expect(isFeatureEnabled(plan('basico'), 'ACTIVE', 'advancedReports')).toBe(false);
    expect(isFeatureEnabled(plan('basico'), 'ACTIVE', 'inventoryAndSales')).toBe(true);
  });

  it('only Premium has advanced management', () => {
    expect(isFeatureEnabled(plan('pro'), 'ACTIVE', 'advancedManagement')).toBe(false);
    expect(isFeatureEnabled(plan('premium'), 'ACTIVE', 'advancedManagement')).toBe(true);
    expect(isFeatureEnabled(plan('pro'), 'ACTIVE', 'onlineCatalog')).toBe(true);
  });
});

describe('limits', () => {
  it('reads limits from the plan', () => {
    expect(limitFor(plan('premium'), 'branches')).toBe(3);
    expect(limitFor(plan('pro'), 'users')).toBe(3);
    expect(limitFor(plan('gratis'), 'products')).toBe(30);
  });

  it('allows up to the limit and rejects beyond it', () => {
    expect(fitsWithinLimit(30, 29)).toBe(true);
    expect(fitsWithinLimit(30, 30)).toBe(false);
    expect(fitsWithinLimit(10, 8, 3)).toBe(false);
  });
});

describe('usageWindow', () => {
  it('TOTAL spans the whole subscription period (trial AI analyses)', () => {
    const w = usageWindow('TOTAL', trial, addDays(start, 3));
    expect(w).toEqual({ start: trial.startedAt, end: trial.currentPeriodEnd });
  });

  it('MONTHLY uses the calendar month in Bolivia (UTC-4)', () => {
    // 2026-12-01 02:00 UTC is still November 30 22:00 in La Paz.
    const w = usageWindow('MONTHLY', trial, new Date('2026-12-01T02:00:00.000Z'));
    expect(w.start.toISOString()).toBe('2026-11-01T04:00:00.000Z');
    expect(w.end.toISOString()).toBe('2026-12-01T04:00:00.000Z');
  });
});
