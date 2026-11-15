export function formatChange(value: number | null): string | null {
  if (value === null) return null;
  const abs = Math.abs(value).toLocaleString("es-BO", { maximumFractionDigits: 1 });
  return value > 0 ? `+${abs} %` : value < 0 ? `−${abs} %` : "0 %";
}

export function shortMoney(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `Bs ${(value / 1_000_000).toLocaleString("es-BO", { maximumFractionDigits: 1 })} M`;
  if (Math.abs(value) >= 1000) return `Bs ${(value / 1000).toLocaleString("es-BO", { maximumFractionDigits: 1 })} mil`;
  return `Bs ${Math.round(value)}`;
}
