import "server-only";
import { cache } from "react";
import { api, ApiError } from "@/lib/api";
import { catalogQuery } from "@/lib/catalog";
import type { PublicCategory, PublicProductDetail, PublicProductPage, PublicStore, SitemapData } from "@/types/catalog";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function orNull<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}

export const getPublicStore = cache((slug: string) =>
  SLUG.test(slug) ? orNull(() => api<PublicStore>(`/public/stores/${slug}`, { auth: false })) : Promise.resolve(null),
);

export const getPublicCategories = cache((slug: string) => api<PublicCategory[]>(`/public/stores/${slug}/categories`, { auth: false }));

export const getPublicProducts = (slug: string, q: Record<string, string | number | undefined>) =>
  api<PublicProductPage>(`/public/stores/${slug}/products${catalogQuery(q)}`, { auth: false });

export const getPublicProduct = cache((slug: string, productSlug: string) =>
  SLUG.test(productSlug) ? orNull(() => api<PublicProductDetail>(`/public/stores/${slug}/products/${productSlug}`, { auth: false })) : Promise.resolve(null),
);

export const getSitemapData = () => api<SitemapData>("/public/sitemap", { auth: false });
