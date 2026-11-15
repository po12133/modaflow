import Link from "next/link";
import { Globe, Lock } from "lucide-react";
import { CATALOG_REQUIRED_PLAN } from "@/config/catalog";
import { cn } from "@modaflow/ui/lib/utils";
import type { CatalogSettings } from "@/types/catalog";
import { CatalogQr } from "./catalog-qr";
import { ShareLink } from "./share-link";

export function CatalogStatus({ settings, url }: { settings: CatalogSettings; url: string }) {
  const label = !settings.planAllowsCatalog ? "No disponible en tu plan" : settings.status === "HIDDEN" ? "Oculto" : "Publicado";
  return (
    <section aria-label="Estado del catálogo" className="grid gap-4 rounded-2xl border bg-card p-4 shadow-sm md:grid-cols-[1fr_auto]">
      <div className="grid content-start gap-3">
        <p className="flex items-center gap-2">
          <Globe className="size-5 text-primary" aria-hidden="true" />
          <b>Tu catálogo</b>
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", settings.isPublic ? "bg-mint/15 text-[#0b7a66]" : "bg-muted text-ink-2")}>{label}</span>
        </p>
        <ShareLink url={url} storeName={settings.name} published={settings.isPublic} />
        {!settings.isPublic && settings.planAllowsCatalog && <p className="text-sm text-muted-foreground">Está oculto: quien abra el enlace verá que no está disponible. Actívalo en Configuración.</p>}
      </div>
      <CatalogQr url={url} slug={settings.slug} />
    </section>
  );
}

export function CatalogUpsell({ operational }: { operational: boolean }) {
  return (
    <section aria-label="Catálogo online" className="grid gap-3 rounded-2xl border border-dashed bg-card p-5">
      <p className="flex items-center gap-2 font-extrabold">
        <Lock className="size-5 text-primary" aria-hidden="true" /> Catálogo online
      </p>
      <p className="text-sm text-muted-foreground">
        {operational
          ? `Tu plan no incluye el catálogo online. Con el plan ${CATALOG_REQUIRED_PLAN} publicas tus prendas en internet, recibes consultas por WhatsApp y compartes tu tienda con un código QR.`
          : "Tu suscripción no está activa: el catálogo público está desactivado. Tus productos y configuración siguen guardados."}
      </p>
      <ul className="grid gap-1 text-sm text-ink-2 sm:grid-cols-2">
        <li>• Enlace propio: /tienda/tu-tienda</li>
        <li>• Carrito y pedidos por WhatsApp</li>
        <li>• Código QR para compartir</li>
        <li>• Fotos, tallas y colores del inventario real</li>
      </ul>
      <Link href="/dashboard/suscripcion" className="inline-flex h-11 items-center justify-center justify-self-start rounded-xl bg-primary px-4 text-sm font-bold text-white">
        Ver planes
      </Link>
    </section>
  );
}
