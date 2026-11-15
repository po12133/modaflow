import "server-only";
import { api } from "@/lib/api";
import { toQuery } from "@/lib/reports";
import type { SalesSummary } from "@/lib/types";
import type {
  CategoryRow,
  InventoryReport,
  PaymentRow,
  PeriodParams,
  ProductsReport,
  ReportSummary,
  SalesChart,
  SalesReport,
} from "@/types/reports";

type Params = Record<string, string | number | undefined>;

export const getReportSummary = (p: PeriodParams) => api<ReportSummary>(`/reports/summary${toQuery({ ...p })}`);

export const getSalesChart = (p: PeriodParams) => api<SalesChart>(`/reports/sales-chart${toQuery({ ...p })}`);

export const getPaymentMethods = (p: PeriodParams) => api<{ items: PaymentRow[] }>(`/reports/payment-methods${toQuery({ ...p })}`);

export const getCategoriesReport = (p: PeriodParams) => api<{ items: CategoryRow[] }>(`/reports/categories${toQuery({ ...p })}`);

export const getSalesReport = (p: PeriodParams, filters: Params) => api<SalesReport>(`/reports/sales${toQuery({ ...p, ...filters })}`);

export const getProductsReport = (p: PeriodParams, filters: Params) => api<ProductsReport>(`/reports/products${toQuery({ ...p, ...filters })}`);

export const getInventoryReport = (p: PeriodParams, filters: Params) => api<InventoryReport>(`/reports/inventory${toQuery({ ...p, ...filters })}`);

export const getDashboardSummary = () => api<SalesSummary>("/dashboard/sales-summary");
