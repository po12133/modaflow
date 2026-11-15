// Shapes returned by the ModaFlow API (see Swagger at /docs). Dates arrive as ISO strings.

export type MembershipRole = "OWNER" | "ADMIN" | "SELLER";
export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "EXPIRED" | "CANCELED";
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

export interface PlanChangeRequest {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELED";
  fromPlan: string;
  toPlan: string;
  note: string | null;
  createdAt: string;
}

/** Error body returned by the API: { statusCode, code, message, errors? }. */
export interface ApiErrorBody {
  statusCode: number;
  code?: string;
  message: string | string[];
  errors?: Record<string, string[]>;
}

/** State returned by form Server Actions to useActionState. */
export interface FormState {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Stage 2: catalog, inventory, photos and AI
// ---------------------------------------------------------------------------

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";
export type MovementType = "INITIAL" | "STOCK_IN" | "MANUAL_OUT" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT";

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

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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
