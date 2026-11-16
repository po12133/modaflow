import { aiCostUsd, roundUsd } from './ai-pricing.js';

export interface AiUsageRow {
  model: string | null;
  succeeded: number;
  failed: number;
  input: number;
  output: number;
}

export interface AiTotals {
  analyses: number;
  failed: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  unpricedModels: string[];
}

export function sumAiUsage(rows: AiUsageRow[]): AiTotals {
  let cost = 0;
  const unpriced = new Set<string>();
  const totals = { analyses: 0, failed: 0, inputTokens: 0, outputTokens: 0 };
  for (const r of rows) {
    totals.analyses += r.succeeded;
    totals.failed += r.failed;
    totals.inputTokens += r.input;
    totals.outputTokens += r.output;
    const c = aiCostUsd(r.model, r.input, r.output);
    if (c === null) unpriced.add(r.model ?? 'desconocido');
    else cost += c;
  }
  return { ...totals, costUsd: roundUsd(cost), unpricedModels: [...unpriced] };
}

export function byModel(rows: AiUsageRow[]) {
  const groups = new Map<string, AiUsageRow[]>();
  for (const r of rows) groups.set(r.model ?? 'desconocido', [...(groups.get(r.model ?? 'desconocido') ?? []), r]);
  return [...groups.entries()]
    .map(([model, list]) => {
      const t = sumAiUsage(list);
      return { model, analyses: t.analyses, failed: t.failed, inputTokens: t.inputTokens, outputTokens: t.outputTokens, costUsd: t.unpricedModels.length ? null : t.costUsd };
    })
    .sort((a, b) => (b.costUsd ?? 0) - (a.costUsd ?? 0) || b.analyses - a.analyses);
}

export function groupBy<T extends { tenantId: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) map.set(r.tenantId, [...(map.get(r.tenantId) ?? []), r]);
  return map;
}
