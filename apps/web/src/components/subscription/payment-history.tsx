import Link from "next/link";
import { PaymentStatusBadge } from "@modaflow/ui/components/payment-status-badge";
import { METHOD_LABELS, PERIOD_KIND_LABELS } from "@modaflow/ui/config/billing";
import { formatDate, formatMoney } from "@modaflow/ui/lib/format";
import type { PaymentRequest, SubscriptionPeriodRow } from "@modaflow/ui/types/billing";

export function PaymentHistory({ payments, periods }: { payments: PaymentRequest[]; periods: SubscriptionPeriodRow[] }) {
  return (
    <section aria-labelledby="payments-title" className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <h2 id="payments-title" className="mb-2 font-extrabold">Historial de pagos</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no registraste pagos.</p>
        ) : (
          <ul className="divide-y text-sm">
            {payments.map((p) => (
              <li key={p.id}>
                <Link href={`/dashboard/suscripcion/pago/${p.id}`} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <b className="block">Plan {p.toPlan.name}</b>
                    <span className="block text-xs text-muted-foreground">
                      {formatDate(p.createdAt)} · {p.method ? METHOD_LABELS[p.method] : ""}
                      {p.status === "REJECTED" && p.reviewNote ? ` · ${p.reviewNote}` : ""}
                    </span>
                  </span>
                  <b className="whitespace-nowrap">{p.amountExpected ? formatMoney(p.amountExpected) : ""}</b>
                  <PaymentStatusBadge status={p.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <h2 className="mb-2 font-extrabold">Periodos cubiertos</h2>
        <ul className="divide-y text-sm">
          {periods.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
              <span>
                <b className="block">{PERIOD_KIND_LABELS[p.kind]} · {p.plan.name}</b>
                <span className="text-xs text-muted-foreground">
                  {formatDate(p.periodStart)} – {formatDate(p.periodEnd)}
                </span>
              </span>
              <b className="whitespace-nowrap">{formatMoney(p.amount)}</b>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
