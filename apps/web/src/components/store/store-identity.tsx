import { Link2 } from "lucide-react";
import { MediaUpload } from "@/components/catalog-admin/media-upload";
import type { CatalogSettings } from "@/types/catalog";

function Address({ label, url, hint }: { label: string; url: string; hint: string }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-xs font-bold text-ink-2">{label}</span>
      <span className="truncate font-mono text-sm" title={url}>{url}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  );
}

export function StoreIdentity({ settings, origin, canEdit }: { settings: CatalogSettings; origin: string; canEdit: boolean }) {
  return (
    <section aria-label="Logotipo y enlaces" className="grid gap-5 rounded-2xl border bg-card p-4 shadow-sm sm:grid-cols-[auto_minmax(0,1fr)] sm:p-6">
      {canEdit ? (
        <MediaUpload kind="logo" label="Logotipo" hint="Cuadrado, JPG/PNG/WebP hasta 10 MB." url={settings.logoUrl} />
      ) : (
        <p className="text-sm text-muted-foreground">Solo la persona propietaria o administradora puede cambiar el logotipo.</p>
      )}
      <div className="grid content-start gap-3">
        <p className="flex items-center gap-2 font-bold">
          <Link2 className="size-4 text-primary" aria-hidden="true" /> Enlaces de tu catálogo
        </p>
        <Address label="Enlace" url={`${origin}${settings.publicPath}`} hint="Se forma con el nombre de tu tienda y cambia si lo cambias." />
        <Address label="Enlace permanente" url={`${origin}${settings.permanentPath}`} hint="Nunca cambia. Úsalo en impresos; el código QR lo usa." />
      </div>
    </section>
  );
}
