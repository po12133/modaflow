import Link from "next/link";
import { Panel } from "@modaflow/ui/components/panel";
import { formatDate, formatMoney } from "@modaflow/ui/lib/format";
import type { AdminTenantDetail } from "@/types/admin";
import { SubscriptionBadge } from "./status-badge";

export function TenantOverview({ tenant }: { tenant: AdminTenantDetail }) {
  const sub = tenant.subscription;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Suscripción">
        {sub ? (
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div><dt className="text-xs text-muted-foreground">Plan</dt><dd className="font-bold">{sub.plan.name}{sub.planVersion ? ` (v${sub.planVersion.version})` : ""}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Estado</dt><dd><SubscriptionBadge status={sub.effectiveStatus} /></dd></div>
            <div><dt className="text-xs text-muted-foreground">Inicio</dt><dd>{formatDate(sub.startedAt)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Vence</dt><dd>{formatDate(sub.currentPeriodEnd)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Precio contratado</dt><dd>{sub.planVersion ? formatMoney(sub.planVersion.priceCents / 100) : "—"}</dd></div>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">Sin suscripción.</p>
        )}
      </Panel>
      <Panel title="Uso">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div><dt className="text-xs text-muted-foreground">Productos activos</dt><dd className="font-bold">{tenant.usage.activeProducts}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Ventas registradas</dt><dd className="font-bold">{tenant.usage.completedSales}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Registro</dt><dd>{formatDate(tenant.createdAt)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">ID</dt><dd className="truncate font-mono text-xs">{tenant.id}</dd></div>
        </dl>
      </Panel>
      <Panel title="Usuarios">
        <ul className="divide-y text-sm">
          {tenant.memberships.map((m) => (
            <li key={m.user.id} className="flex items-center justify-between gap-2 py-2">
              <Link href={`/usuarios/${m.user.id}`} className="min-w-0">
                <b className="block truncate">{m.user.name}</b>
                <span className="block truncate text-xs text-muted-foreground">{m.user.email}</span>
              </Link>
              <span className="text-xs font-semibold">{m.role}{m.user.status === "SUSPENDED" ? " · suspendido" : ""}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Tiendas">
        <ul className="divide-y text-sm">
          {tenant.stores.map((s) => (
            <li key={s.id} className="py-2">
              <b>{s.name}</b>
              <span className="block text-xs text-muted-foreground">{s.city} · {s.whatsapp} · /{s.slug} · {s.publicCode}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
