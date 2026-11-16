/** Reference list prices of the Claude API in USD per million tokens (input / output). */
export const AI_PRICES_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
  'claude-fable-5-2': { input: 8, output: 40 },
  'claude-fable-5-1': { input: 10, output: 50 },
};

export function aiCostUsd(model: string | null, inputTokens: number, outputTokens: number): number | null {
  const price = model ? AI_PRICES_USD_PER_MTOK[model] : undefined;
  if (!price) return inputTokens + outputTokens === 0 ? 0 : null;
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}

export const roundUsd = (value: number) => Math.round(value * 10_000) / 10_000;
