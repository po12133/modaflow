import "server-only";
import { api } from "@/lib/api";
import { catalogQuery } from "@/lib/catalog";
import type { Paginated } from "@/lib/types";
import type { CatalogProductRow, CatalogSettings, CatalogSummary, OrderRequestDetail, OrderRequestRow } from "@/types/catalog";

type Query = Record<string, string | number | undefined>;

export const getCatalogSettings = () => api<CatalogSettings>("/catalog/settings");

export const getCatalogSummary = () => api<CatalogSummary>("/catalog/summary");

export const getCatalogProducts = (q: Query) => api<Paginated<CatalogProductRow>>(`/catalog/products${catalogQuery(q)}`);

export const getOrderRequests = (q: Query) => api<Paginated<OrderRequestRow>>(`/catalog/order-requests${catalogQuery(q)}`);

export const getOrderRequest = (id: string) => api<OrderRequestDetail>(`/catalog/order-requests/${encodeURIComponent(id)}`);
