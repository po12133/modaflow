import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { ApiError, api } from "./api";
import type { AiUsage, Category, Entitlements, Me, Plan, PlanChangeRequest, ProductDetail, Store } from "./types";

/**
 * Data access layer: every read goes through the API with the user's session,
 * and the API re-checks authentication and tenant membership. Results are
 * deduplicated per request with React `cache`.
 */

export const getMe = cache(async (): Promise<Me | null> => {
  try {
    return await api<Me>("/auth/me");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
});

/** Authenticated user or redirect to /login. */
export async function requireUser(): Promise<Me> {
  const me = await getMe();
  if (!me) redirect("/login");
  return me;
}

export interface DashboardContext {
  me: Me & { membership: NonNullable<Me["membership"]> };
  store: Store;
  subscription: Entitlements;
}

/** Everything the subscriber panel needs; sends users without a store to onboarding. */
export const getDashboardContext = cache(async (): Promise<DashboardContext> => {
  const me = await requireUser();
  if (me.needsOnboarding || !me.membership) redirect("/onboarding");
  const [store, subscription] = await Promise.all([
    api<Store>("/stores/current"),
    api<Entitlements>("/subscription"),
  ]);
  return { me: { ...me, membership: me.membership }, store, subscription };
});

export const getPlans = cache(() => api<Plan[]>("/plans", { auth: false }));

export const getPlanChangeRequests = cache(() => api<PlanChangeRequest[]>("/subscription/change-requests"));

export const getCategories = cache(() => api<Category[]>("/categories"));

export const getAiUsage = cache(() => api<AiUsage>("/ai/usage"));

/** Product detail or null when it does not exist / belongs to another store. */
export const getProduct = cache(async (id: string): Promise<ProductDetail | null> => {
  try {
    return await api<ProductDetail>(`/products/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
});
