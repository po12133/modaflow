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
