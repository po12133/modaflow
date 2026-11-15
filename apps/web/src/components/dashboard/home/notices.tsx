import { Clock } from "lucide-react";
import { plural } from "@/lib/format";
import type { Entitlements, PlanChangeRequest } from "@/lib/types";

export function Notices({ subscription, pending }: { subscription: Entitlements; pending?: PlanChangeRequest }) {
  return (
    <>
{(pending || (subscription.status === "TRIALING" && subscription.daysRemaining <= 3)) && (
        <section aria-labelledby="notices-title" className="grid gap-2">
          <h2 id="notices-title" className="text-sm font-bold text-muted-foreground">
            Avisos
          </h2>
          {subscription.status === "TRIALING" && subscription.daysRemaining <= 3 && (
            <p className="flex items-center gap-2.5 rounded-xl border border-[#f5dfa8] bg-[#fff7e6] px-3.5 py-3 text-sm font-semibold text-[#7a4f00]">
              <Clock className="size-4 shrink-0" aria-hidden="true" />
              Tu prueba termina en {plural(subscription.daysRemaining, "día")}. Elige un plan para no perder el acceso.
            </p>
          )}
          {pending && (
            <p className="flex items-center gap-2.5 rounded-xl border border-[#c9dafc] bg-[#e7efff] px-3.5 py-3 text-sm font-semibold text-[#2357b8]">
              <Clock className="size-4 shrink-0" aria-hidden="true" />
              Solicitaste el plan {pending.toPlan}. Te contactaremos para coordinar el pago.
            </p>
          )}
        </section>
      )}
    </>
  );
}
