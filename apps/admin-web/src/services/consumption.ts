import "server-only";
import { api } from "@/lib/api";
import { toQuery } from "@modaflow/ui/lib/query";
import type { AccountUsage, AiLogItem, ConsumptionSummary, PeriodPage, TenantConsumption } from "@/types/consumption";

type Query = Record<string, string | number | undefined>;

export const getConsumption = (q: Query) => api<ConsumptionSummary>(`/admin/consumption${toQuery(q)}`);
export const getConsumptionAccounts = (q: Query) => api<PeriodPage<AccountUsage>>(`/admin/consumption/accounts${toQuery(q)}`);
export const getAiLog = (q: Query) => api<PeriodPage<AiLogItem>>(`/admin/consumption/ai-log${toQuery(q)}`);
export const getTenantConsumption = (id: string) => api<TenantConsumption>(`/admin/consumption/tenants/${encodeURIComponent(id)}`);
