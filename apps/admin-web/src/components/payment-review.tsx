import { approvePaymentAction, rejectPaymentAction } from "@/actions/admin";
import { Panel } from "@modaflow/ui/components/panel";
import { METHOD_LABELS, PERIOD_KIND_LABELS } from "@modaflow/ui/config/billing";
import { formatDate, formatDateTime, formatMoney, STATUS_LABELS } from "@modaflow/ui/lib/format";
import type { AdminPaymentDetail } from "@/types/admin";
import { ActionDialog, dialogField } from "./action-dialog";

export function PaymentReview({ payment, canReview }: { payment: AdminPaymentDetail; canReview: boolean }) {
  const sub = payment.tenant.subscription;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Panel title="Comprobante">
        {payment.receiptUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed S3 URL
          <img src={payment.receiptUrl} alt="Comprobante enviado por el suscriptor" className="max-h-[70vh] w-full rounded-xl border object-contain" />
        ) : (
          <p className="text-sm text-muted-foreground">El suscriptor todavía no subió el comprobante.</p>
        )}
      </Panel>
      <div className="grid content-start gap-4">
        <Panel title="Solicitud">
          <dl className="grid gap-1.5 text-sm">
            <div className="flex justify-between"><dt>Importe esperado</dt><dd className="text-lg font-extrabold">{payment.amountExpected ? formatMoney(payment.amountExpected) : "—"}</dd></div>
            <div className="flex justify-between"><dt>Plan</dt><dd>{payment.fromPlan.name} → <b>{payment.toPlan.name}</b>{payment.planVersion ? ` (v${payment.planVersion.version})` : ""}</dd></div>
            <div className="flex justify-between"><dt>Método</dt><dd>{payment.method ? METHOD_LABELS[payment.method] : "—"}</dd></div>
            <div className="flex justify-between"><dt>Solicitado por</dt><dd>{payment.requestedBy.name}</dd></div>
            <div className="flex justify-between"><dt>Enviado</dt><dd>{payment.submittedAt ? formatDateTime(payment.submittedAt) : "No"}</dd></div>
            {sub && <div className="flex justify-between"><dt>Suscripción actual</dt><dd>{sub.plan.name} · {STATUS_LABELS[sub.status]} · vence {formatDate(sub.currentPeriodEnd)}</dd></div>}
            {payment.reviewedBy && <div className="flex justify-between"><dt>Revisado por</dt><dd>{payment.reviewedBy.name}{payment.reviewedAt ? ` · ${formatDateTime(payment.reviewedAt)}` : ""}</dd></div>}
            {payment.reviewNote && <div><dt>Observación</dt><dd className="text-ink-2">{payment.reviewNote}</dd></div>}
            {payment.period && <div><dt>Periodo cubierto</dt><dd className="font-semibold">{PERIOD_KIND_LABELS[payment.period.kind]}: {formatDate(payment.period.periodStart)} – {formatDate(payment.period.periodEnd)}</dd></div>}
          </dl>
        </Panel>
        {canReview && payment.status === "PENDING" && (
          <div className="flex flex-wrap gap-2">
            <ActionDialog trigger="Aprobar pago" title="Aprobar pago" description={`Se activará o renovará el plan ${payment.toPlan.name}. Esta acción no se puede repetir.`} confirm="Aprobar y activar" requireReason={false} action={approvePaymentAction.bind(null, payment.id)}>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="amountVerified" required className="mt-0.5 size-5 accent-[#6c4cf5]" />
                Verifiqué que {payment.amountExpected ? formatMoney(payment.amountExpected) : "el importe"} ingresó a la cuenta de ModaFlow.
              </label>
              <label className="grid gap-1 text-sm font-semibold">
                Observación (opcional)
                <input name="note" maxLength={500} className={dialogField} />
              </label>
            </ActionDialog>
            <ActionDialog trigger="Rechazar" title="Rechazar pago" description="El suscriptor verá el motivo y podrá enviar un nuevo comprobante." confirm="Rechazar" danger reasonLabel="Motivo del rechazo" action={rejectPaymentAction.bind(null, payment.id)} />
          </div>
        )}
      </div>
    </div>
  );
}
