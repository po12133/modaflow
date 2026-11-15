import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CatalogUpsell } from "@/components/catalog-admin/catalog-status";
import { MediaUpload } from "@/components/catalog-admin/media-upload";
import { SettingsForm } from "@/components/catalog-admin/settings-form";
import { PageHeader } from "@/components/dashboard/common";
import { getDashboardContext } from "@/lib/dal";
import { getCatalogSettings } from "@/services/catalog";
import { siteOrigin } from "@/services/site";

export const metadata: Metadata = { title: "Configuración del catálogo" };

export const instant = false;

export default async function CatalogSettingsPage() {
  const [{ me, subscription }, settings, origin] = await Promise.all([getDashboardContext(), getCatalogSettings(), siteOrigin()]);
  const canEdit = settings.planAllowsCatalog && me.membership.role !== "SELLER";
  return (
    <div className="grid gap-5">
      <Link href="/dashboard/catalogo" className="inline-flex items-center gap-1 justify-self-start text-sm font-semibold text-primary">
        <ChevronLeft className="size-4" aria-hidden="true" /> Catálogo
      </Link>
      <PageHeader title="Configuración del catálogo" description="Una plantilla adaptada a la identidad de tu tienda." />
      {!settings.planAllowsCatalog && <CatalogUpsell operational={subscription.isOperational} />}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <SettingsForm settings={settings} origin={origin} disabled={!canEdit} />
        </section>
        {canEdit && (
          <section aria-label="Imágenes" className="grid gap-5 rounded-2xl border bg-card p-4 shadow-sm">
            <MediaUpload kind="logo" label="Logotipo" hint="Cuadrado, JPG/PNG/WebP hasta 10 MB." url={settings.logoUrl} />
            <MediaUpload kind="cover" label="Imagen de portada" hint="Horizontal, se muestra arriba de tus prendas." url={settings.coverUrl} />
          </section>
        )}
      </div>
    </div>
  );
}
