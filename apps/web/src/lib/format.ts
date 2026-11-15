const BO_TZ = "America/La_Paz";

const dateFmt = new Intl.DateTimeFormat("es-BO", { day: "numeric", month: "long", year: "numeric", timeZone: BO_TZ });
const shortDateFmt = new Intl.DateTimeFormat("es-BO", { day: "numeric", month: "short", timeZone: BO_TZ });
const numberFmt = new Intl.NumberFormat("es-BO");

export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

export function formatShortDate(iso: string): string {
  return shortDateFmt.format(new Date(iso));
}

export function formatNumber(n: number): string {
  return numberFmt.format(n);
}

/** Bs 69 / Bs 0 (prices are stored in centavos). */
export function formatPrice(cents: number): string {
  const value = cents / 100;
  return `Bs ${Number.isInteger(value) ? formatNumber(value) : value.toFixed(2)}`;
}

export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${formatNumber(n)} ${n === 1 ? singular : pluralForm}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export const STATUS_LABELS = {
  TRIALING: "Prueba gratuita",
  ACTIVE: "Activa",
  EXPIRED: "Vencida",
  CANCELED: "Cancelada",
} as const;

export const ROLE_LABELS = {
  OWNER: "Propietario",
  ADMIN: "Administrador",
  SELLER: "Vendedor",
} as const;

/** "M · Rojo", "Talla única". */
export function variantLabel(v: { size: string | null; color: string | null }): string {
  return [v.size || "Talla única", v.color].filter(Boolean).join(" · ");
}

const moneyFmt = new Intl.NumberFormat("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Decimal string from the API ("40.50") -> "Bs 40,50"; whole amounts -> "Bs 85". */
export function formatMoney(value: string | number): string {
  const n = typeof value === "number" ? value : Number(value);
  return `Bs ${Number.isInteger(n) ? formatNumber(n) : moneyFmt.format(n)}`;
}

export const PAYMENT_LABELS = {
  CASH: "Efectivo",
  QR: "QR bancario",
  TRANSFER: "Transferencia",
  OTHER: "Otro",
} as const;

const dateTimeFmt = new Intl.DateTimeFormat("es-BO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/La_Paz",
});

export function formatDateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso));
}
