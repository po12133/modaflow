import type { Paginated, SubscriptionStatus } from "@modaflow/ui/types/common";
import type { ApiErrorBody } from "@modaflow/ui/lib/api-error";
import type { FormState } from "@modaflow/ui/types/forms";

export type { ApiErrorBody, FormState, Paginated, SubscriptionStatus };
// Shapes returned by the ModaFlow API (see Swagger at /docs). Dates arrive as ISO strings.

export type MembershipRole = "OWNER" | "ADMIN" | "SELLER";
export type UsagePeriod = "TOTAL" | "MONTHLY";
export type CatalogAccess = "NONE" | "TEMPORARY" | "FULL";

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface Me {
  user: User;
  membership: { tenantId: string; tenantName: string; role: MembershipRole } | null;
  needsOnboarding: boolean;
}

export interface Store {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  whatsapp: string;
  city: string;
  address: string | null;
  primaryColor: string;
  timezone: string;
  logoUrl: string | null;
  updatedAt: string;
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  tagline: string;
  priceCents: number;
  currency: string;
  billingPeriod: "TRIAL" | "MONTHLY";
  durationDays: number | null;
  isTrial: boolean;
  isRecommended: boolean;
  limits: {
    products: number;
    aiAnalyses: number;
    aiAnalysesPeriod: UsagePeriod;
    users: number;
    branches: number;
  };
  features: {
    inventoryAndSales: boolean;
    advancedReports: boolean;
    onlineCatalog: CatalogAccess;
    advancedManagement: boolean;
  };
  highlights: string[];
}

export interface LimitUsage {
  limit: number;
  used: number;
}

export interface Entitlements {
  plan: { id: string; code: string; name: string; isTrial: boolean; priceCents: number; billingPeriod: string };
  status: SubscriptionStatus;
  isOperational: boolean;
  startedAt: string;
  expiresAt: string;
  daysRemaining: number;
  dataRetentionUntil: string | null;
  limits: {
    products: LimitUsage;
    aiAnalyses: LimitUsage & { period: UsagePeriod; periodStart: string; periodEnd: string };
    users: LimitUsage;
    branches: LimitUsage;
  };
  features: {
    inventoryAndSales: boolean;
    advancedReports: boolean;
    onlineCatalog: boolean;
    advancedManagement: boolean;
  };
}

/** Error body returned by the API: { statusCode, code, message, errors? }. */

/** State returned by form Server Actions to useActionState. */

// ---------------------------------------------------------------------------
// Stage 2: catalog, inventory, photos and AI
// ---------------------------------------------------------------------------

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";
export type MovementType = "INITIAL" | "STOCK_IN" | "MANUAL_OUT" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "SALE" | "SALE_CANCEL";

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  productCount: number;
}

export interface ProductImage {
  id: string;
  url: string | null;
  thumbUrl: string | null;
  width: number;
  height: number;
  position: number;
  isPrimary: boolean;
}

export interface Variant {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  stock: number;
}

export interface ProductListItem {
  id: string;
  sku: string;
  name: string;
  color: string | null;
  garmentType: string | null;
  category: { id: string; name: string } | null;
  salePrice: string;
  totalStock: number;
  lowStockThreshold: number;
  stockStatus: StockStatus;
  status: "ACTIVE" | "ARCHIVED";
  sizes: string[];
  variantCount: number;
  image: ProductImage | null;
  createdAt: string;
}

export interface ProductDetail {
  id: string;
  sku: string;
  slug: string;
  catalogPublished: boolean;
  name: string;
  description: string | null;
  garmentType: string | null;
  color: string | null;
  secondaryColors: string[];
  style: string | null;
  category: { id: string; name: string } | null;
  tags: string[];
  salePrice: string;
  purchasePrice: string | null;
  lowStockThreshold: number;
  totalStock: number;
  stockStatus: StockStatus;
  status: "ACTIVE" | "ARCHIVED";
  variants: Variant[];
  images: ProductImage[];
  aiAssisted: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}


export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  totalStock: number;
  lowStockThreshold: number;
  stockStatus: StockStatus;
  variants: Variant[];
}

export interface InventoryResponse extends Paginated<InventoryItem> {
  summary: { products: number; units: number; lowStock: number; outOfStock: number };
}

export interface Movement {
  id: string;
  type: MovementType;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  reason: string | null;
  reference: string | null;
  product: { id: string; name: string; sku: string };
  variant: { id: string; sku: string; size: string | null; color: string | null };
  user: string;
  createdAt: string;
}

export interface AiUsage {
  available: boolean;
  aiConfigured: boolean;
  storageConfigured: boolean;
  isOperational: boolean;
  limit: number;
  used: number;
  remaining: number;
  period: UsagePeriod;
  periodStart: string;
  periodEnd: string;
}

export interface GarmentSuggestion {
  isGarment: boolean;
  name: string;
  description: string;
  garmentType: string;
  category: { id: string; name: string } | null;
  suggestedCategory: string | null;
  color: string;
  secondaryColors: string[];
  size: string | null;
  style: string;
  features: string[];
  tags: string[];
  message: string;
}

export interface AiAnalysis {
  id: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  suggestion: GarmentSuggestion | null;
  creditsCharged: number;
  usage: { limit: number; used: number; remaining: number };
}

// ---------------------------------------------------------------------------
// Stage 3: point of sale, sales and receipts
// ---------------------------------------------------------------------------

export type PaymentMethod = "CASH" | "QR" | "TRANSFER" | "OTHER";
export type DiscountType = "PERCENT" | "AMOUNT";
export type SaleStatus = "COMPLETED" | "CANCELED";

export interface Discount {
  type: DiscountType;
  value: string;
}

export interface PosProduct {
  id: string;
  name: string;
  sku: string;
  salePrice: string;
  totalStock: number;
  color: string | null;
  category: { id: string; name: string } | null;
  image: ProductImage | null;
  variants: Variant[];
}

export interface SalePreview {
  items: {
    variantId: string;
    productName: string;
    size: string | null;
    color: string | null;
    available: number;
    quantity: number;
    unitPrice: string;
    unitDiscount: string;
    finalUnitPrice: string;
    lineTotal: string;
  }[];
  subtotal: string;
  itemsDiscount: string;
  discountAmount: string;
  total: string;
  units: number;
  change: { receivedCents: number; changeCents: number } | null;
  issues: { index: number; variantId: string; code: string; message: string; available?: number }[];
  canConfirm: boolean;
}

export interface SaleItem {
  id: string;
  productId: string;
  variantId: string;
  productName: string;
  sku: string;
  size: string | null;
  color: string | null;
  quantity: number;
  unitPrice: string;
  discountType: DiscountType | null;
  discountValue: string | null;
  unitDiscount: string;
  finalUnitPrice: string;
  lineTotal: string;
}

export interface SaleDetail {
  id: string;
  number: string;
  status: SaleStatus;
  createdAt: string;
  seller: { id: string; name: string };
  paymentMethod: PaymentMethod;
  amountReceived: string | null;
  changeGiven: string | null;
  subtotal: string;
  itemsDiscount: string;
  discountType: DiscountType | null;
  discountValue: string | null;
  discountAmount: string;
  total: string;
  unitCount: number;
  items: SaleItem[];
  cancellation: { reason: string; notes: string | null; restockedUnits: number; user: string; createdAt: string } | null;
  receiptPath: string | null;
  movements: {
    id: string;
    type: MovementType;
    quantity: number;
    stockBefore: number;
    stockAfter: number;
    createdAt: string;
    variant: { sku: string; size: string | null; color: string | null };
    product: { id: string; name: string };
    user: string;
  }[];
}

export interface SaleListItem {
  id: string;
  number: string;
  createdAt: string;
  total: string;
  unitCount: number;
  paymentMethod: PaymentMethod;
  status: SaleStatus;
  seller: string;
  preview: string[];
}

export interface SalesList extends Paginated<SaleListItem> {
  summary: { count: number; total: string };
}

export interface Receipt {
  number: string;
  status: SaleStatus;
  createdAt: string;
  canceledAt: string | null;
  seller: string;
  store: { name: string; city: string; whatsapp: string; address: string | null; primaryColor: string };
  items: Omit<SaleItem, "id" | "productId" | "variantId">[];
  subtotal: string;
  itemsDiscount: string;
  discountType: DiscountType | null;
  discountValue: string | null;
  discountAmount: string;
  total: string;
  unitCount: number;
  paymentMethod: PaymentMethod;
  amountReceived: string | null;
  changeGiven: string | null;
  notice: string;
}

export interface SalesSummary {
  today: { sales: number; total: string; units: number };
  month: { sales: number; total: string; units: number };
  lowStock: { total: number; items: { id: string; name: string; sku: string; stock: number; threshold: number; category: string | null; unique: boolean }[] };
  recent: { id: string; number: string; total: string; unitCount: number; paymentMethod: PaymentMethod; status: SaleStatus; createdAt: string }[];
}
