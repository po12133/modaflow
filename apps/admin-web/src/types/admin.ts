import type { Paginated, SubscriptionStatus } from "@modaflow/ui/types/common";
import type { PaymentStatus, PeriodKind, PlatformMethod } from "@modaflow/ui/types/billing";

export type StaffRole = "SUPERADMIN" | "SUPPORT";

export interface StaffMe {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  lastLoginAt: string | null;
}

export interface AdminKpis {
  tenants: number;
  activeTenants: number;
  trials: number;
  paidActive: number;
  expired: number;
  suspended: number;
  pendingPayments: { count: number; amount: string };
  revenueThisMonth: string;
  revenueTotal: string;
  mrr: string;
  arpu: string | null;
}

export interface AdminCharts {
  granularity: string;
  points: { key: string; label: string; revenue: string; newTenants: number }[];
  conversions: number;
  renewals: number;
  cancellations: number;
  subscriptionsByPlan: { plan: string; count: number }[];
}

export interface AdminDashboard {
  period: { key: string; label: string; from: string; to: string };
  kpis: AdminKpis;
  charts: AdminCharts;
}

export interface AdminStatistics extends AdminDashboard {
  revenue: { inPeriod: string; paymentsInPeriod: number; newSubscriptions: number; byPlan: { plan: string; total: string; payments: number }[]; monthly: { month: string; total: string }[] };
  conversion: { registeredUsers: number; trialTenants: number; convertedTenants: number; conversionPct: number | null };
  usage: { tenants: number; activeProducts: number; aiAnalyses: number; salesRegistered: number; catalogsWithProducts: number; catalogRequests: number; activeUsers30d: number };
}

export interface AdminTenantRow {
  id: string;
  name: string;
  createdAt: string;
  owner: { id: string; name: string; email: string } | null;
  whatsapp: string | null;
  city: string | null;
  plan: { code: string; name: string } | null;
  status: SubscriptionStatus | null;
  expiresAt: string | null;
}

export interface AdminTenantDetail {
  id: string;
  name: string;
  createdAt: string;
  stores: { id: string; name: string; slug: string; publicCode: string; city: string; whatsapp: string; createdAt: string }[];
  memberships: { role: string; createdAt: string; user: { id: string; name: string; email: string; status: string; lastLoginAt: string | null } }[];
  subscription: { id: string; status: SubscriptionStatus; effectiveStatus: SubscriptionStatus; startedAt: string; currentPeriodEnd: string; plan: { code: string; name: string; isTrial: boolean }; planVersion: { version: number; priceCents: number } | null } | null;
  subscriptionHistory: { id: string; action: string; fromStatus: string | null; toStatus: string | null; reason: string | null; createdAt: string; actor: { name: string } | null; actorStaff: { name: string } | null }[];
  subscriptionPeriods: { id: string; kind: PeriodKind; periodStart: string; periodEnd: string; amount: string; plan: { name: string } }[];
  planChangeRequests: { id: string; status: PaymentStatus; amountExpected: string | null; method: PlatformMethod | null; createdAt: string; submittedAt: string | null; reviewedAt: string | null; toPlan: { name: string } }[];
  usage: { activeProducts: number; completedSales: number };
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  status: "ACTIVE" | "SUSPENDED";
  createdAt: string;
  lastLoginAt: string | null;
  suspendedReason: string | null;
  memberships: { role: string; tenant: { id: string; name: string } }[];
}

export interface AdminPlan {
  id: string;
  code: string;
  name: string;
  tagline: string;
  priceCents: number;
  durationDays: number | null;
  billingPeriod: string;
  isTrial: boolean;
  isActive: boolean;
  isRecommended: boolean;
  sortOrder: number;
  maxProducts: number;
  aiAnalysesLimit: number;
  maxUsers: number;
  maxBranches: number;
  inventoryAndSales: boolean;
  advancedReports: boolean;
  onlineCatalog: "NONE" | "TEMPORARY" | "FULL";
  advancedManagement: boolean;
  highlights: string[];
  currentVersion: number | null;
  subscriptions: number;
}

export interface AdminSubscriptionRow {
  id: string;
  status: SubscriptionStatus;
  effectiveStatus: SubscriptionStatus;
  startedAt: string;
  currentPeriodEnd: string;
  tenant: { id: string; name: string };
  plan: { code: string; name: string };
  periodPrice: string | null;
  lastPayment: { date: string; amount: string } | null;
  nextRenewal: string | null;
}

export interface AdminPaymentRow {
  id: string;
  status: PaymentStatus;
  method: PlatformMethod | null;
  amountExpected: string | null;
  amountConfirmed: string | null;
  submittedAt: string | null;
  createdAt: string;
  reviewedAt: string | null;
  hasReceipt: boolean;
  tenant: { id: string; name: string };
  toPlan: { name: string };
}

export type AdminPaymentPage = Paginated<AdminPaymentRow> & { pendingReview: number };

export interface AdminPaymentDetail extends Omit<AdminPaymentRow, "hasReceipt" | "tenant"> {
  receiptUrl: string | null;
  reviewNote: string | null;
  tenant: { id: string; name: string; subscription: { status: SubscriptionStatus; currentPeriodEnd: string; plan: { name: string } } | null };
  fromPlan: { name: string };
  requestedBy: { name: string; email: string };
  reviewedBy: { name: string } | null;
  planVersion: { version: number; priceCents: number } | null;
  period: { kind: PeriodKind; periodStart: string; periodEnd: string; amount: string } | null;
}

export interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  result: "SUCCESS" | "FAILURE";
  createdAt: string;
  actor: { id: string; name: string; email: string } | null;
}

export interface PlatformSettingsView {
  platformName: string;
  contactEmail: string | null;
  supportWhatsapp: string | null;
  currency: string;
  timezone: string;
  trialDays: number;
  renewalNoticeDays: number;
  renewalPolicy: string | null;
  dataRetentionDays: number;
  qrEnabled: boolean;
  transferEnabled: boolean;
  accountHolder: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountType: string | null;
  paymentInstructions: string | null;
  qrImageUrl: string | null;
  notificationEmails: string[];
  updatedAt: string;
}
