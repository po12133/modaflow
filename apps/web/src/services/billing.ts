import "server-only";
import { api } from "@/lib/api";
import type { NotificationPage, PaymentInfo, PaymentRequest, SubscriptionPeriodRow } from "@/types/billing";

export const getPaymentInfo = () => api<PaymentInfo>("/subscription/payment-info");

export const getPaymentRequests = () => api<PaymentRequest[]>("/subscription/payment-requests");

export const getPaymentRequest = (id: string) => api<PaymentRequest>(`/subscription/payment-requests/${encodeURIComponent(id)}`);

export const getSubscriptionPeriods = () => api<SubscriptionPeriodRow[]>("/subscription/periods");

export const getNotifications = (page = 1) => api<NotificationPage>(`/notifications?page=${page}`);
