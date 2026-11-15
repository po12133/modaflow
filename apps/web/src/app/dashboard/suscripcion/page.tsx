import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/common";
import { PlanCards } from "@/components/plans/plan-cards";
import { PlansTable } from "@/components/plans/plans-table";
import { CurrentPlanCard } from "@/components/subscription/current-plan-card";
import { PayPlanButton } from "@/components/subscription/pay-plan-button";
import { PaymentHistory } from "@/components/subscription/payment-history";
import { UsageCard } from "@/components/subscription/usage-card";
import { getDashboardContext, getPlans } from "@/lib/dal";
import { getPaymentInfo, getPaymentRequests, getSubscriptionPeriods } from "@/services/billing";

export const metadata: Metadata = { title: "Suscripción" };

export const instant = false;

export default async function SubscriptionPage() {
  const [{ me, subscription: sub }, plans, info, payments, periods] = await Promise.all([getDashboardContext(), getPlans(), getPaymentInfo(), getPaymentRequests(), getSubscriptionPeriods()]);
  const pending = payments.find((p) => p.status === "PENDING");
  const isOwner = me.membership.role === "OWNER";
  const canPay = isOwner && sub.status !== "SUSPENDED" && !pending;

  return (
    <div className="grid min-w-0 gap-6 *:min-w-0">
      <PageHeader title="Suscripción" description="Tu plan, su consumo, tus pagos y los planes disponibles." />
      <section className="grid gap-4 lg:grid-cols-2">
        <CurrentPlanCard sub={sub} />
        <UsageCard sub={sub} />
      </section>
      {pending && (
        <Link href={`/dashboard/suscripcion/pago/${pending.id}`} className="rounded-2xl border border-amber/40 bg-[#fff7e6] p-4 text-sm font-semibold text-[#7a4f00]">
          {pending.submittedAt ? `Tu comprobante para el plan ${pending.toPlan.name} está en revisión.` : `Tienes un pago pendiente para el plan ${pending.toPlan.name}. Toca para completarlo.`}
        </Link>
      )}
      <section aria-labelledby="plans-title" className="grid gap-4">
        <h2 id="plans-title" className="text-lg font-extrabold">Planes</h2>
        <PlanCards
          plans={plans}
          currentPlanCode={sub.plan.code}
          renderAction={(plan) =>
            plan.isTrial || !canPay ? null : (
              <PayPlanButton planCode={plan.code} methods={info.methods} label={plan.code === sub.plan.code ? "Renovar este plan" : `Pagar plan ${plan.name}`} />
            )
          }
        />
        {!isOwner && <p className="text-sm text-muted-foreground">Solo el propietario puede pagar o cambiar el plan.</p>}
        <PlansTable plans={plans} />
      </section>
      <PaymentHistory payments={payments} periods={periods} />
    </div>
  );
}
