import type { Metadata } from "next";
import { CatalogLinks, CatalogStats } from "@/components/catalog-admin/catalog-stats";
import { CatalogStatus, CatalogUpsell } from "@/components/catalog-admin/catalog-status";
import { PageHeader } from "@/components/dashboard/common";
import { getDashboardContext } from "@/lib/dal";
import { getCatalogSettings, getCatalogSummary } from "@/services/catalog";
import { siteOrigin } from "@/services/site";

export const metadata: Metadata = { title: "Catálogo online" };

export const instant = false;

export default async function CatalogPage() {
  const [{ subscription }, settings, summary, origin] = await Promise.all([getDashboardContext(), getCatalogSettings(), getCatalogSummary(), siteOrigin()]);
  return (
    <div className="grid gap-5">
      <PageHeader title="Catálogo online" description="Muestra tus prendas en internet y recibe consultas por WhatsApp." />
      {settings.planAllowsCatalog ? <CatalogStatus settings={settings} url={`${origin}${settings.publicPath}`} /> : <CatalogUpsell operational={subscription.isOperational} />}
      <CatalogStats summary={summary} />
      <CatalogLinks pending={summary.pendingRequests} />
    </div>
  );
}
