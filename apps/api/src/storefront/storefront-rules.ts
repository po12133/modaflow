export const STORE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const STORE_SLUG_MIN = 3;
export const STORE_SLUG_MAX = 60;
export const MAX_REQUEST_LINES = 20;
export const MAX_LINE_QUANTITY = 10;
export const PUBLIC_STOCK_CAP = 10;

export const RESERVED_SLUGS = new Set([
  'admin', 'api', 'app', 'ayuda', 'blog', 'boleta', 'carrito', 'catalogo', 'contacto', 'cuenta', 'dashboard', 'docs',
  'login', 'logout', 'mail', 'modaflow', 'nueva', 'onboarding', 'panel', 'planes', 'precios', 'privacidad', 'registro',
  'robots', 'sitemap', 'soporte', 'static', 'status', 'terminos', 'tienda', 'tiendas', 'www', 'recuperar-contrasena',
  'restablecer-contrasena',
]);

export type SlugProblem = 'format' | 'length' | 'reserved';

export function storeSlugProblem(slug: string): SlugProblem | null {
  if (slug.length < STORE_SLUG_MIN || slug.length > STORE_SLUG_MAX) return 'length';
  if (!STORE_SLUG_PATTERN.test(slug)) return 'format';
  if (RESERVED_SLUGS.has(slug)) return 'reserved';
  return null;
}

export function toSlug(value: string, max = 100): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
}

export function productSlug(name: string, sku: string): string {
  return `${toSlug(name) || 'prenda'}-${toSlug(sku) || 'p'}`;
}

export interface MessageLine {
  name: string;
  size: string | null;
  color: string | null;
  quantity: number;
  lineTotal: string;
}

export function formatBs(amount: string): string {
  const [int, dec] = Number(amount).toFixed(2).split('.');
  const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return dec === '00' ? `Bs ${grouped}` : `Bs ${grouped},${dec}`;
}

export function orderMessage(storeName: string, intro: string | null, lines: MessageLine[], total: string, code: string): string {
  const header = intro?.trim() || `Hola, quiero consultar por estas prendas de ${storeName}:`;
  const body = lines.map((l, i) => {
    const variant = [l.size && `Talla ${l.size}`, l.color].filter(Boolean).join(' · ');
    const units = `${l.quantity} ${l.quantity === 1 ? 'unidad' : 'unidades'}`;
    return `${i + 1}. ${l.name}${variant ? ` — ${variant}` : ''} — ${units} — ${formatBs(l.lineTotal)}`;
  });
  return [header, '', ...body, '', `Total referencial: ${formatBs(total)}.`, '', '¿Están disponibles?', `(Consulta ${code})`].join('\n');
}

export function whatsappUrl(phoneE164: string, text: string): string {
  return `https://wa.me/${phoneE164.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}
