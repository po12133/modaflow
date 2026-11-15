import type { Metadata } from "next";
import { updateStoreAction } from "@/actions/store";
import { PageHeader } from "@/components/dashboard/common";
import { StoreForm } from "@/components/store/store-form";
import { getDashboardContext } from "@/lib/dal";
import { formatDate } from "@modaflow/ui/lib/format";

export const metadata: Metadata = { title: "Configuración de la tienda" };

// Per-request page (reads the session through the API).
export const instant = false;

export default async function StoreSettingsPage() {
  const { me, store } = await getDashboardContext();
  const canEdit = me.membership.role === "OWNER" || me.membership.role === "ADMIN";

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Configuración de la tienda"
        description={`Última actualización: ${formatDate(store.updatedAt)}`}
      />
      <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
        {canEdit ? (
          <StoreForm action={updateStoreAction} store={store} submitLabel="Guardar cambios" />
        ) : (
          <p className="text-sm text-muted-foreground">Solo la persona propietaria o administradora puede modificar la tienda.</p>
        )}
      </section>
    </div>
  );
}
