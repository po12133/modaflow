import { extendTrialAction, manualPaymentAction, subscriptionTransitionAction, tenantStatusAction } from "@/actions/admin";
import type { AdminPlan, AdminTenantDetail } from "@/types/admin";
import { ActionDialog, dialogField } from "./action-dialog";

function PaymentFields({ plans }: { plans?: AdminPlan[] }) {
  return (
    <>
      {plans && (
        <label className="grid gap-1 text-sm font-semibold">
          Plan
          <select name="planCode" required className={dialogField}>
            {plans.filter((p) => !p.isTrial && p.isActive).map((p) => (
              <option key={p.code} value={p.code}>{p.name} · Bs {(p.priceCents / 100).toFixed(2)}</option>
            ))}
          </select>
        </label>
      )}
      <label className="grid gap-1 text-sm font-semibold">
        Método
        <select name="method" className={dialogField}>
          <option value="TRANSFER">Transferencia bancaria</option>
          <option value="QR">QR bancario</option>
        </select>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="amountVerified" required className="mt-0.5 size-5 accent-[#6c4cf5]" />
        Verifiqué que el importe del plan ingresó a la cuenta de ModaFlow.
      </label>
    </>
  );
}

export function SubscriptionActions({ tenant, plans }: { tenant: AdminTenantDetail; plans: AdminPlan[] }) {
  const sub = tenant.subscription;
  if (!sub) return null;
  const suspended = sub.effectiveStatus === "SUSPENDED";
  return (
    <div className="flex flex-wrap gap-2">
      {suspended ? (
        <ActionDialog trigger="Reactivar negocio" title="Reactivar negocio" description="El negocio vuelve a su estado anterior (o vencido si su periodo terminó)." confirm="Reactivar" action={tenantStatusAction.bind(null, tenant.id, "REACTIVATE")} />
      ) : (
        <ActionDialog trigger="Suspender negocio" title="Suspender negocio" description="El negocio queda en solo lectura y su catálogo público deja de estar disponible. No se elimina ningún dato." confirm="Suspender" danger action={tenantStatusAction.bind(null, tenant.id, "SUSPEND")} />
      )}
      {!suspended && sub.plan.isTrial && (
        <ActionDialog trigger="Extender prueba" title="Extender la prueba gratuita" description="Se suman días desde hoy o desde el vencimiento actual, lo que sea posterior." confirm="Extender" action={extendTrialAction.bind(null, sub.id)}>
          <label className="grid gap-1 text-sm font-semibold">
            Días
            <input name="days" type="number" min={1} max={60} defaultValue={7} required className={dialogField} />
          </label>
        </ActionDialog>
      )}
      {!suspended && !sub.plan.isTrial && (
        <ActionDialog trigger="Renovar (pago manual)" title={`Renovar plan ${sub.plan.name}`} description="Registra un pago recibido fuera de la plataforma. Si está activa, renueva desde el vencimiento vigente." confirm="Registrar y renovar" action={manualPaymentAction.bind(null, sub.id)}>
          <PaymentFields />
        </ActionDialog>
      )}
      {!suspended && (
        <ActionDialog trigger="Cambiar plan (pago manual)" title="Activar o cambiar de plan" description="Registra el pago del plan elegido; el nuevo periodo empieza hoy." confirm="Registrar y activar" action={manualPaymentAction.bind(null, sub.id)}>
          <PaymentFields plans={plans} />
        </ActionDialog>
      )}
      {sub.effectiveStatus !== "CANCELED" && (
        <ActionDialog trigger="Cancelar suscripción" title="Cancelar suscripción" description="El negocio pasa a solo lectura. Se conserva el historial y los datos." confirm="Cancelar suscripción" danger action={subscriptionTransitionAction.bind(null, sub.id, "cancel")} />
      )}
    </div>
  );
}
