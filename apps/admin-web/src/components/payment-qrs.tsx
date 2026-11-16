import { formatMoney } from "@modaflow/ui/lib/format";
import type { PlanQr } from "@/types/admin";
import { QrUpload } from "./settings-form";

export function PaymentQrs({ general, plans, canEdit }: { general: string | null; plans: PlanQr[]; canEdit: boolean }) {
  return (
    <div className="grid content-start gap-4">
      <section className="grid gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div>
          <b>QR por plan</b>
          <p className="text-xs text-muted-foreground">Cada QR lleva el monto exacto del plan. Si cambias el precio de un plan, sube su QR nuevo.</p>
        </div>
        <ul className="grid gap-4">
          {plans.map((p) => (
            <li key={p.code} className="grid gap-2 border-t pt-3 first:border-0 first:pt-0">
              <p className="flex flex-wrap items-baseline gap-2">
                <b>{p.name}</b>
                <span className="text-sm font-bold text-primary">{formatMoney(p.priceCents / 100)}</span>
                {!p.isActive && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">inactivo</span>}
                {!p.qrImageUrl && <span className="text-xs text-muted-foreground">usa el QR general</span>}
              </p>
              <QrUpload url={p.qrImageUrl} plan={p.code} alt={`QR del plan ${p.name}`} disabled={!canEdit} />
            </li>
          ))}
        </ul>
      </section>
      <section className="grid gap-2 rounded-2xl border bg-card p-4 shadow-sm">
        <b>QR general</b>
        <p className="text-xs text-muted-foreground">Se muestra en los planes que no tienen QR propio. Es el QR para cobrar suscripciones, no el del catálogo ni el de las tiendas.</p>
        <QrUpload url={general} alt="QR general de ModaFlow" disabled={!canEdit} />
      </section>
    </div>
  );
}
