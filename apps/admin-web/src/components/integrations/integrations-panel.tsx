import { ShieldAlert } from "lucide-react";
import { formatDateTime } from "@modaflow/ui/lib/format";
import type { IntegrationSection, IntegrationsView } from "@/types/integrations";
import { IntegrationForm } from "./integration-form";

export function IntegrationsPanel({ section, view, canEdit }: { section: IntegrationSection; view: IntegrationsView; canEdit: boolean }) {
  return (
    <div className="grid gap-3">
      {!view.encryptionReady && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-amber/15 px-3 py-2.5 text-sm font-semibold text-[#8a5a00]">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Falta SETTINGS_ENCRYPTION_KEY en el servidor: puedes editar los datos no secretos, pero las llaves solo se pueden cambiar en las variables de entorno.
        </p>
      )}
      <IntegrationForm section={section} state={view[section]} version={view.updatedAt} canEdit={canEdit} encryptionReady={view.encryptionReady} />
      <p className="text-xs text-muted-foreground">
        Última modificación: {formatDateTime(view.updatedAt)}
        {view.updatedBy ? ` por ${view.updatedBy}` : ""}. La contraseña de la base de datos y la clave de cifrado solo se cambian en el servidor.
      </p>
    </div>
  );
}
