import "server-only";
import { cache } from "react";
import { api } from "@/lib/api";
import { catalogQuery } from "@/lib/catalog";
import type { Paginated } from "@/lib/types";
import type { AdminDashboard, AdminPaymentDetail, AdminPaymentPage, AdminPlan, AdminStatistics, AdminSubscriptionRow, AdminTenantDetail, AdminTenantRow, AdminUserRow, AuditRow, PlatformSettingsView } from "@/types/admin";
import type { NotificationPage } from "@/types/billing";

type Query = Record<string, string | number | undefined>;

export const getAdminDashboard = (q: Query) => api<AdminDashboard>(`/admin/dashboard${catalogQuery(q)}`);
export const getAdminStatistics = (q: Query) => api<AdminStatistics>(`/admin/statistics${catalogQuery(q)}`);
export const getAdminTenants = (q: Query) => api<Paginated<AdminTenantRow>>(`/admin/tenants${catalogQuery(q)}`);
export const getAdminTenant = cache((id: string) => api<AdminTenantDetail>(`/admin/tenants/${encodeURIComponent(id)}`));
export const getAdminUsers = (q: Query) => api<Paginated<AdminUserRow>>(`/admin/users${catalogQuery(q)}`);
export const getAdminUser = (id: string) => api<AdminUserRow & { activeSessions: number }>(`/admin/users/${encodeURIComponent(id)}`);
export const getAdminPlans = cache(() => api<AdminPlan[]>("/admin/plans"));
export const getAdminSubscriptions = (q: Query) => api<Paginated<AdminSubscriptionRow>>(`/admin/subscriptions${catalogQuery(q)}`);
export const getAdminPayments = (q: Query) => api<AdminPaymentPage>(`/admin/payments${catalogQuery(q)}`);
export const getAdminPayment = (id: string) => api<AdminPaymentDetail>(`/admin/payments/${encodeURIComponent(id)}`);
export const getAdminAudit = (q: Query) => api<Paginated<AuditRow>>(`/admin/audit${catalogQuery(q)}`);
export const getAdminNotifications = (page: number) => api<NotificationPage>(`/admin/notifications?page=${page}`);
export const getPlatformSettings = () => api<PlatformSettingsView>("/admin/settings");
