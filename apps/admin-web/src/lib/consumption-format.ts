const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });
const compact = new Intl.NumberFormat("es-BO", { notation: "compact", maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("es-BO");

export const formatUsd = (value: number | null) => (value === null ? "Sin precio" : usd.format(value));

export const formatTokens = (value: number) => (value >= 10_000 ? compact.format(value) : whole.format(value));

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${whole.format(Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export const MODEL_LABELS: Record<string, string> = {
  "claude-opus-5-5": "Claude Opus 5.5",
  "claude-sonnet-5-5": "Claude Sonnet 5.5",
  "claude-sonnet-5": "Claude Sonnet 5",
  "claude-haiku-5-5": "Claude Haiku 5.5",
  "claude-fable-5-2": "Claude Fable 5.2",
  "claude-fable-5-1": "Claude Fable 5.1",
};

export const modelLabel = (model: string | null) => (model ? (MODEL_LABELS[model] ?? model) : "—");

export const AI_STATUS: Record<string, { label: string; tone: string }> = {
  SUCCEEDED: { label: "Correcto", tone: "bg-mint/15 text-[#0b7a66]" },
  FAILED: { label: "Falló (sin cobro)", tone: "bg-destructive/10 text-destructive" },
  PENDING: { label: "En curso", tone: "bg-amber/15 text-[#7a4f00]" },
};
