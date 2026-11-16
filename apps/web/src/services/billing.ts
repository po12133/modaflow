import "server-only";
import { api } from "@/lib/api";
import type { NotificationPage, PaymentInfo, PaymentRequest, SubscriptionPeriodRow } from "@modaflow/ui/types/billing";

export const getPaymentInfo = (planCode?: string) =>
  api<PaymentInfo>(`/subscription/payment-info${planCode ? `?plan=${encodeURIComponent(planCode)}` : ""}`);

export const getPaymentRequests = () => api<PaymentRequest[]>("/subscription/payment-requests");

export const getPaymentRequest = (id: string) => api<PaymentRequest>(`/subscription/payment-requests/${encodeURIComponent(id)}`);

export const getSubscriptionPeriods = () => api<SubscriptionPeriodRow[]>("/subscription/periods");

export const getNotifications = (page = 1) => api<NotificationPage>(`/notifications?page=${page}`);
