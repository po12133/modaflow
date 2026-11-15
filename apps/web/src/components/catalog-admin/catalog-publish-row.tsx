import Link from "next/link";
import { PublishToggle } from "./publish-toggle";

export function CatalogPublishRow({ id, published, enabled }: { id: string; published: boolean; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/40 p-3">
      <span className="text-sm">
        <b className="block">Mostrar en catálogo online</b>
        <span className="text-xs text-muted-foreground">
          {enabled ? "No cambia el stock ni el estado del producto." : <Link href="/dashboard/suscripcion" className="font-semibold text-primary">Disponible en el plan Pro</Link>}
        </span>
      </span>
      <PublishToggle id={id} published={published} disabled={!enabled} />
    </div>
  );
}
