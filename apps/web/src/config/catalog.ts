import type { RequestStatus } from "@/types/catalog";

export const PUBLIC_SORTS: [string, string][] = [
  ["newest", "Más recientes"],
  ["price_asc", "Precio: menor a mayor"],
  ["price_desc", "Precio: mayor a menor"],
  ["name", "Nombre"],
];

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  CREATED: "Creada",
  WHATSAPP_OPENED: "WhatsApp abierto",
  ATTENDED: "Atendida",
  CANCELED: "Cancelada",
};

export const REQUEST_STATUS_TONES: Record<RequestStatus, string> = {
  CREATED: "bg-muted text-ink-2",
  WHATSAPP_OPENED: "bg-[#e7efff] text-[#2357b8]",
  ATTENDED: "bg-mint/15 text-[#0b7a66]",
  CANCELED: "bg-destructive/10 text-destructive",
};

export const CATALOG_PAGE_SIZE = 24;
export const CART_MAX_LINES = 20;
export const CART_MAX_QUANTITY = 10;
export const CART_STORAGE_PREFIX = "mf_catalog_cart_";
export const CATALOG_REQUIRED_PLAN = "Pro";
