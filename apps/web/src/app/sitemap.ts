import type { MetadataRoute } from "next";
import { siteOrigin } from "@/services/site";
import { getSitemapData } from "@/services/storefront";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await siteOrigin();
  const home: MetadataRoute.Sitemap = [{ url: origin, changeFrequency: "weekly", priority: 1 }];
  try {
    const data = await getSitemapData();
    return [
      ...home,
      ...data.stores.map((s) => ({ url: `${origin}/tienda/${s.slug}`, lastModified: s.updatedAt, changeFrequency: "daily" as const, priority: 0.8 })),
      ...data.products.map((p) => ({ url: `${origin}/tienda/${p.store}/producto/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "daily" as const, priority: 0.6 })),
    ];
  } catch {
    return home;
  }
}
