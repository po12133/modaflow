import type { Paginated } from "@/lib/types";

export type CatalogStatus = "PUBLISHED" | "HIDDEN";
export type OutOfStockMode = "SHOW" | "HIDE";
export type RequestStatus = "CREATED" | "WHATSAPP_OPENED" | "ATTENDED" | "CANCELED";

export interface CatalogSettings {
  name: string;
  slug: string;
  publicCode: string;
  description: string | null;
  whatsapp: string;
  city: string;
  primaryColor: string;
  secondaryColor: string;
  welcomeMessage: string | null;
  outOfStock: OutOfStockMode;
  status: CatalogStatus;
  logoUrl: string | null;
  coverUrl: string | null;
  publicPath: string;
  permanentPath: string;
  planAllowsCatalog: boolean;
  isPublic: boolean;
}

export interface CatalogSummary {
  published: number;
  hidden: number;
  publishedOutOfStock: number;
  requests: number;
  pendingRequests: number;
}

export interface CatalogProductRow {
  id: string;
  name: string;
  sku: string;
  slug: string;
  salePrice: string;
  totalStock: number;
  catalogPublished: boolean;
  category: string | null;
  thumbUrl: string | null;
}

export interface OrderRequestRow {
  id: string;
  code: string;
  status: RequestStatus;
  itemCount: number;
  unitCount: number;
  total: string;
  createdAt: string;
  preview: string[];
}

export interface OrderRequestDetail {
  id: string;
  code: string;
  status: RequestStatus;
  total: string;
  itemCount: number;
  unitCount: number;
  createdAt: string;
  whatsappOpenedAt: string | null;
  statusChangedAt: string | null;
  saleId: string | null;
  items: {
    productId: string;
    productStatus: string;
    productName: string;
    sku: string;
    size: string | null;
    color: string | null;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }[];
}

export interface PublicStore {
  slug: string;
  name: string;
  description: string | null;
  city: string;
  address: string | null;
  whatsapp: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  coverUrl: string | null;
}

export interface PublicImage {
  url: string | null;
  width: number;
  height: number;
}

export interface PublicProductCard {
  slug: string;
  name: string;
  price: string;
  category: string | null;
  color: string | null;
  sizes: string[];
  available: boolean;
  image: PublicImage | null;
}

export type PublicProductPage = Paginated<PublicProductCard>;

export interface PublicVariant {
  sku: string;
  size: string | null;
  color: string | null;
  available: number;
}

export interface PublicProductDetail {
  slug: string;
  name: string;
  description: string | null;
  price: string;
  category: string | null;
  color: string | null;
  available: boolean;
  images: { url: string | null; thumbUrl: string | null; width: number; height: number }[];
  variants: PublicVariant[];
}

export interface PublicCategory {
  slug: string;
  name: string;
  products: number;
}

export interface CartLine {
  productSlug: string;
  sku: string;
  name: string;
  variant: string;
  price: string;
  quantity: number;
  max: number;
  image: string | null;
}

export interface OrderRequestResult {
  code: string;
  token: string;
  total: string;
  message: string;
  whatsappUrl: string;
}

export interface OrderIssue {
  index: number;
  code: "NOT_FOUND" | "OUT_OF_STOCK" | "INSUFFICIENT_STOCK";
  available: number;
}

export interface SitemapData {
  stores: { slug: string; updatedAt: string }[];
  products: { store: string; slug: string; updatedAt: string }[];
}
