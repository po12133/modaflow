export type PaymentStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELED";
export type PlatformMethod = "QR" | "TRANSFER";
export type PeriodKind = "TRIAL" | "ACTIVATION" | "RENEWAL" | "PLAN_CHANGE" | "EXTENSION";

export interface PaymentInfo {
  methods: PlatformMethod[];
  accountHolder: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountType: string | null;
  instructions: string | null;
  qrImageUrl: string | null;
  supportWhatsapp: string | null;
  currency: string;
}

export interface PaymentRequest {
  id: string;
  status: PaymentStatus;
  method: PlatformMethod | null;
  amountExpected: string | null;
  amountConfirmed: string | null;
  hasReceipt: boolean;
  receiptUrl: string | null;
  receiptUploadedAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  toPlan: { code: string; name: string };
  fromPlan: { name: string };
  period: { kind: PeriodKind; periodStart: string; periodEnd: string } | null;
}

export interface SubscriptionPeriodRow {
  id: string;
  kind: PeriodKind;
  periodStart: string;
  periodEnd: string;
  amount: string;
  plan: { name: string };
  createdAt: string;
}

export interface AppNotification {
  id: string;
  audience: "TENANT" | "ADMIN";
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  emailStatus: string;
  createdAt: string;
}

export interface NotificationPage {
  items: AppNotification[];
  total: number;
  unread: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
