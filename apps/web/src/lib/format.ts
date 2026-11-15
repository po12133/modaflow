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
