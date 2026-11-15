import { Transform } from 'class-transformer';

/**
 * Normalizes a WhatsApp number to E.164. Bolivian mobile numbers may be typed
 * without country code (8 digits starting with 6 or 7 => +591...).
 * Returns null when the input cannot be a valid number.
 */
export function normalizeWhatsapp(input: string): string | null {
  const trimmed = input.trim();
  if (!/^\+?[\d\s\-().]+$/.test(trimmed)) return null;
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!hasPlus) {
    if (/^[67]\d{7}$/.test(digits)) return `+591${digits}`;
    if (/^591[67]\d{7}$/.test(digits)) return `+${digits}`;
    return null;
  }
  return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
}

export const NormalizeWhatsapp = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    return normalizeWhatsapp(value) ?? value;
  });

export const WHATSAPP_E164 = /^\+[1-9]\d{7,14}$/;
export const WHATSAPP_MESSAGE = 'Ingresa un WhatsApp válido, por ejemplo 71234567 o +59171234567.';

export const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export const UppercaseHex = () =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value));

/** URL-friendly slug from a store name: "Mio Shop Ñandú" => "mio-shop-nandu". */
export function slugify(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return slug || 'tienda';
}
