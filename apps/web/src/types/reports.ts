import type { MovementType, PaymentMethod, SaleStatus } from "@/lib/types";
import type { ReportPeriodKey } from "@/config/reports";

export interface PeriodParams {
  period?: string;
  from?: string;
  to?: string;
}

export interface ReportPeriodView {
  key: ReportPeriodKey;
  label: string;
  from: string;
  to: string;
  start: string;
  end: string;
  timezone: string;
  inProgress: boolean;
  granularity: "hour" | "day" | "week" | "month";
  previous: { label: string; from: string; to: string; start: string; end: string };
}

export interface ReportAccess {
  advanced: boolean;
  plan: string;
  operational: boolean;
}

export interface Kpis {
  sales: number;
  units: number;
  total: string;
  subtotal: string;
  itemsDiscount: string;
  generalDiscount: string;
  discounts: string;
  averageTicket: string;
  canceled: { sales: number; total: string };
}

export interface GrossProfit {
  revenue: string;
  knownRevenue: string;
  knownCost: string;
  grossProfit: string;
  marginPct: number | null;
  unitsWithoutCost: number;
  revenueWithoutCost: string;
  complete: boolean;
}

export interface Comparison {
  previous: { label: string; from: string; to: string; until: string; kpis: Kpis };
  partial: boolean;
  rule: string;
  changes: { total: number | null; sales: number | null; units: number | null; averageTicket: number | null };
}

export interface ReportSummary {
  store: string;
  period: ReportPeriodView;
  kpis: Kpis;
  profit: GrossProfit | null;
  comparison: Comparison | null;
  access: ReportAccess;
}

export interface ChartPoint {
  key: string;
  label: string;
  total: string | null;
  sales: number | null;
  units: number | null;
  previousTotal: string | null;
}

export interface SalesChart {
  period: ReportPeriodView;
  granularity: ReportPeriodView["granularity"];
  points: ChartPoint[];
}

export interface CategoryRow {
  categoryId: string | null;
  name: string;
  units: number;
  revenue: string;
}

export interface PaymentRow {
  method: PaymentMethod;
  sales: number;
  total: string;
}

export interface SalesReportRow {
  id: string;
  number: string;
  createdAt: string;
  units: number;
  subtotal: string;
  discounts: string;
  total: string;
  paymentMethod: PaymentMethod;
  seller: string;
  status: SaleStatus;
}

export interface SalesReport {
  store: string;
  period: ReportPeriodView;
  kpis: Kpis;
  sellers: { id: string; name: string }[];
  items: SalesReportRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  access: ReportAccess;
}

export interface ProductReportRow {
  productId: string;
  name: string;
  sku: string;
  status: string;
  category: string | null;
  thumbUrl: string | null;
  units: number;
  sales: number;
  revenue: string;
  grossSales: string;
  profit: GrossProfit;
}

export interface ProductsReport {
  store: string;
  period: ReportPeriodView;
  sort: "units_desc" | "units_asc" | "revenue_desc" | "revenue_asc";
  items: ProductReportRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  variants: { variantId: string; productId: string; productName: string; sku: string; size: string | null; color: string | null; units: number; revenue: string }[];
  categories: CategoryRow[];
}

export interface LowStockItem {
  id: string;
  name: string;
  sku: string;
  stock: number;
  threshold: number;
  category: string | null;
  unique: boolean;
}

export interface InventoryReport {
  store: string;
  period: ReportPeriodView;
  stock: { activeProducts: number; units: number; outOfStock: number };
  lowStock: { threshold: number | null; total: number; uniqueExcluded: number; items: LowStockItem[] };
  value: { costValue: string; retailValue: string; unitsWithoutCost: number; productsWithoutCost: number; complete: boolean } | null;
  movements: { type: MovementType; movements: number; units: number }[] | null;
  access: ReportAccess;
}
