import Link from "next/link";
import { Panel } from "@/components/common/panel";
import { PaymentStatusBadge } from "@/components/subscription/payment-history";
import { HISTORY_LABELS } from "@/config/admin";
import { PERIOD_KIND_LABELS } from "@/config/billing";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import type { AdminTenantDetail } from "@/types/admin";

export function TenantHistory({ tenant }: { tenant: AdminTenantDetail }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Pagos">
        {tenant.planChangeRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin pagos.</p>
        ) : (
          <ul className="divide-y text-sm">
            {tenant.planChangeRequests.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/pagos/${p.id}`} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    <b className="block">{p.toPlan.name} · {p.amountExpected ? formatMoney(p.amountExpected) : ""}</b>
                    <span className="text-xs text-muted-foreground">{formatDate(p.createdAt)}</span>
                  </span>
                  <PaymentStatusBadge status={p.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Periodos">
        <ul className="divide-y text-sm">
          {tenant.subscriptionPeriods.map((p) => (
            <li key={p.id} className="flex justify-between gap-2 py-2">
              <span>
                <b className="block">{PERIOD_KIND_LABELS[p.kind]} · {p.plan.name}</b>
                <span className="text-xs text-muted-foreground">{formatDate(p.periodStart)} – {formatDate(p.periodEnd)}</span>
              </span>
              <b>{formatMoney(p.amount)}</b>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Historial de la suscripción" className="lg:col-span-2">
        <ul className="divide-y text-sm">
          {tenant.subscriptionHistory.map((h) => (
            <li key={h.id} className="py-2">
              <b>{HISTORY_LABELS[h.action] ?? h.action}</b>
              <span className="text-xs text-muted-foreground"> · {formatDateTime(h.createdAt)} · {h.actor?.name ?? "Sistema"}</span>
              {h.reason && <span className="block text-xs text-ink-2">{h.reason}</span>}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
