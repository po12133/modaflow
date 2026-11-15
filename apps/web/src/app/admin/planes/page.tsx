import type { Metadata } from "next";
import { PlanEditor } from "@/components/admin/plan-editor";
import { formatMoney } from "@/lib/format";
import { getMe } from "@/lib/dal";
import { getAdminPlans } from "@/services/admin";

export const metadata: Metadata = { title: "Planes" };

export const instant = false;

const CATALOG = { NONE: "No", TEMPORARY: "Solo en prueba", FULL: "Sí" } as const;

export default async function PlansPage() {
  const [plans, me] = await Promise.all([getAdminPlans(), getMe()]);
  const canEdit = me?.user.globalRole === "SUPERADMIN";
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Planes</h1>
      <p className="text-sm text-muted-foreground">Los planes viven en PostgreSQL y alimentan la comparación comercial. Cada cambio de condiciones crea una versión nueva.</p>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {plans.map((p) => (
          <li key={p.id} className="grid content-start gap-2 rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <b className="text-lg">{p.name}</b>
                <p className="text-xs text-muted-foreground">v{p.currentVersion ?? 1} · {p.subscriptions} suscripciones{p.isActive ? "" : " · no disponible"}</p>
              </div>
              {canEdit && <PlanEditor plan={p} />}
            </div>
            <p className="text-2xl font-extrabold text-primary">{formatMoney(p.priceCents / 100)}<span className="text-sm font-semibold text-muted-foreground"> / {p.isTrial ? `${p.durationDays} días` : "mes"}</span></p>
            <dl className="grid grid-cols-2 gap-1 text-xs">
              <dt className="text-muted-foreground">Productos</dt><dd>{p.maxProducts}</dd>
              <dt className="text-muted-foreground">Créditos IA</dt><dd>{p.aiAnalysesLimit}</dd>
              <dt className="text-muted-foreground">Usuarios</dt><dd>{p.maxUsers}</dd>
              <dt className="text-muted-foreground">Sucursales</dt><dd>{p.maxBranches}</dd>
              <dt className="text-muted-foreground">Reportes avanzados</dt><dd>{p.advancedReports ? "Sí" : "No"}</dd>
              <dt className="text-muted-foreground">Catálogo online</dt><dd>{CATALOG[p.onlineCatalog]}</dd>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
