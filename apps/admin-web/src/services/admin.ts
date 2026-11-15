import "server-only";
import { cache } from "react";
import { api } from "@/lib/api";
import { toQuery } from "@modaflow/ui/lib/query";
import type { Paginated } from "@modaflow/ui/types/common";
import type { AdminDashboard, AdminPaymentDetail, AdminPaymentPage, AdminPlan, AdminStatistics, AdminSubscriptionRow, AdminTenantDetail, AdminTenantRow, AdminUserRow, AuditRow, PlatformSettingsView } from "@/types/admin";
import type { NotificationPage } from "@modaflow/ui/types/billing";
import type { IntegrationsView } from "@/types/integrations";
import type { StaffMember } from "@/types/staff";

type Query = Record<string, string | number | undefined>;

export const getAdminDashboard = (q: Query) => api<AdminDashboard>(`/admin/dashboard${toQuery(q)}`);
export const getAdminStatistics = (q: Query) => api<AdminStatistics>(`/admin/statistics${toQuery(q)}`);
export const getAdminTenants = (q: Query) => api<Paginated<AdminTenantRow>>(`/admin/tenants${toQuery(q)}`);
export const getAdminTenant = cache((id: string) => api<AdminTenantDetail>(`/admin/tenants/${encodeURIComponent(id)}`));
export const getAdminUsers = (q: Query) => api<Paginated<AdminUserRow>>(`/admin/users${toQuery(q)}`);
export const getAdminUser = (id: string) => api<AdminUserRow & { activeSessions: number }>(`/admin/users/${encodeURIComponent(id)}`);
export const getAdminPlans = cache(() => api<AdminPlan[]>("/admin/plans"));
export const getAdminSubscriptions = (q: Query) => api<Paginated<AdminSubscriptionRow>>(`/admin/subscriptions${toQuery(q)}`);
export const getAdminPayments = (q: Query) => api<AdminPaymentPage>(`/admin/payments${toQuery(q)}`);
export const getAdminPayment = (id: string) => api<AdminPaymentDetail>(`/admin/payments/${encodeURIComponent(id)}`);
export const getAdminAudit = (q: Query) => api<Paginated<AuditRow>>(`/admin/audit${toQuery(q)}`);
export const getAdminNotifications = (page: number) => api<NotificationPage>(`/admin/notifications?page=${page}`);
export const getPlatformSettings = () => api<PlatformSettingsView>("/admin/settings");
export const getStaff = () => api<StaffMember[]>("/admin/staff");
export const getIntegrations = () => api<IntegrationsView>("/admin/integrations");
