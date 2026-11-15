import { updatePlanAction } from "@/actions/admin";
import type { AdminPlan } from "@/types/admin";
import { ActionDialog, dialogField } from "./action-dialog";

function Num({ name, label, value, step }: { name: string; label: string; value: number; step?: string }) {
  return (
    <label className="grid gap-1 text-xs font-semibold">
      {label}
      <input name={name} type="number" min={0} step={step ?? "1"} defaultValue={value} required className={dialogField} />
    </label>
  );
}

function Check({ name, label, value }: { name: string; label: string; value: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={value} className="size-5 accent-[#6c4cf5]" />
      {label}
    </label>
  );
}

export function PlanEditor({ plan }: { plan: AdminPlan }) {
  return (
    <ActionDialog
      trigger="Editar"
      title={`Editar plan ${plan.name}`}
      description="Si cambian precio, límites o funciones se crea una nueva versión: los periodos ya contratados conservan sus condiciones y las nuevas aplican al renovar o contratar."
      confirm="Guardar cambios"
      reasonLabel="Motivo del cambio"
      action={updatePlanAction.bind(null, plan.id)}
    >
      <div className="grid max-h-[50vh] gap-3 overflow-y-auto pr-1">
        <label className="grid gap-1 text-xs font-semibold">Nombre<input name="name" defaultValue={plan.name} required className={dialogField} /></label>
        <label className="grid gap-1 text-xs font-semibold">Descripción<input name="tagline" defaultValue={plan.tagline} required className={dialogField} /></label>
        <div className="grid grid-cols-2 gap-2">
          <Num name="price" label="Precio (Bs)" value={plan.priceCents / 100} step="0.01" />
          <Num name="sortOrder" label="Orden" value={plan.sortOrder} />
          <Num name="maxProducts" label="Productos" value={plan.maxProducts} />
          <Num name="aiAnalysesLimit" label="Créditos IA" value={plan.aiAnalysesLimit} />
          <Num name="maxUsers" label="Usuarios" value={plan.maxUsers} />
          <Num name="maxBranches" label="Sucursales" value={plan.maxBranches} />
        </div>
        <label className="grid gap-1 text-xs font-semibold">
          Catálogo online
          <select name="onlineCatalog" defaultValue={plan.onlineCatalog} className={dialogField}>
            <option value="NONE">No incluido</option>
            <option value="TEMPORARY">Solo durante la prueba</option>
            <option value="FULL">Incluido</option>
          </select>
        </label>
        <Check name="inventoryAndSales" label="Inventario y ventas" value={plan.inventoryAndSales} />
        <Check name="advancedReports" label="Reportes avanzados" value={plan.advancedReports} />
        <Check name="advancedManagement" label="Gestión avanzada" value={plan.advancedManagement} />
        <Check name="isActive" label="Disponible para contratar" value={plan.isActive} />
        <Check name="isRecommended" label="Recomendado" value={plan.isRecommended} />
        <label className="grid gap-1 text-xs font-semibold">
          Puntos destacados (uno por línea)
          <textarea name="highlights" rows={4} defaultValue={plan.highlights.join("\n")} className={`${dialogField} h-auto py-2`} />
        </label>
      </div>
    </ActionDialog>
  );
}
