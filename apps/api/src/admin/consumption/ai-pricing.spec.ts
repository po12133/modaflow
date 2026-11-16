import { aiCostUsd, roundUsd } from './ai-pricing.js';

describe('aiCostUsd', () => {
  it('prices input and output tokens per million', () => {
    expect(aiCostUsd('claude-opus-5-5', 5_000, 400)).toBeCloseTo(0.028);
    expect(aiCostUsd('claude-haiku-5-5', 1_000_000, 1_000_000)).toBeCloseTo(0.6);
  });

  it('returns null for models without a known price, and 0 when nothing was used', () => {
    expect(aiCostUsd('claude-desconocido', 10, 10)).toBeNull();
    expect(aiCostUsd(null, 0, 0)).toBe(0);
    expect(roundUsd(0.123456)).toBe(0.1235);
  });
});
