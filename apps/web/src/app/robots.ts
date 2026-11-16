import type { MetadataRoute } from "next";
import { siteOrigin } from "@/services/site";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await siteOrigin();
  return {
    rules: [{ userAgent: "*", allow: ["/"], disallow: ["/dashboard", "/api/", "/onboarding", "/boleta/", "/*/carrito"] }],
    sitemap: `${origin}/sitemap.xml`,
  };
}
