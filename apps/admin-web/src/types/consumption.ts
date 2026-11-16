export interface PeriodView {
  key: string;
  label: string;
  from: string;
  to: string;
}

export interface AiTotals {
  analyses: number;
  failed: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  unpricedModels: string[];
}

export interface ProductCounts {
  created: number;
  deleted: number;
  active: number;
}

export interface ImageCounts {
  total: number;
  aiScanned: number;
  bytes: number;
}

export interface ModelUsage {
  model: string;
  analyses: number;
  failed: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
}

export interface ConsumptionSummary {
  period: PeriodView;
  prices: Record<string, { input: number; output: number }>;
  ai: AiTotals;
  byModel: ModelUsage[];
  products: ProductCounts;
  images: ImageCounts;
}

export interface AccountUsage {
  tenantId: string;
  name: string;
  plan: string | null;
  ai: AiTotals;
  products: ProductCounts;
  images: ImageCounts;
  sales: number;
}

export interface TenantConsumption {
  ai: AiTotals;
  products: ProductCounts;
  images: ImageCounts;
  completedSales: number;
}

export type AiStatus = "SUCCEEDED" | "FAILED" | "PENDING";

export interface AiLogItem {
  id: string;
  status: AiStatus;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  errorCode: string | null;
  createdAt: string;
  completedAt: string | null;
  tenant: { id: string; name: string };
  user: { name: string };
  product: { id: string; name: string; status: "ACTIVE" | "DELETED" } | null;
  imageCount: number;
  thumbUrl: string | null;
  costUsd: number | null;
}

export interface PeriodPage<T> {
  period: PeriodView;
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
