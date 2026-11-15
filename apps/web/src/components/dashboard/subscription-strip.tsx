import Link from "next/link";
import { CircleAlert, Sparkles } from "lucide-react";
import { formatDate, plural } from "@/lib/format";
import type { Entitlements } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Persistent subscription notice under the top bar (trial countdown or read-only warning). */
export function SubscriptionStrip({ subscription }: { subscription: Entitlements }) {
  const { status, daysRemaining, isOperational, dataRetentionUntil, plan } = subscription;
  if (status === "ACTIVE" && daysRemaining > 5) return null;

  const expired = !isOperational;
  return (
    <div
      role={expired ? "alert" : "status"}
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-4 py-2.5 text-sm lg:px-6",
        expired ? "bg-[#fdeeee] text-[#9b1f26]" : "bg-gradient-to-r from-[#efeaff] to-[#ffe9f1] text-violet-strong",
      )}
    >
      {expired ? <CircleAlert className="size-4 shrink-0" aria-hidden="true" /> : <Sparkles className="size-4 shrink-0" aria-hidden="true" />}
      <p className="min-w-0 flex-1">
        {expired ? (
          <>
            <strong>Tu {plan.isTrial ? "prueba gratuita" : "suscripción"} terminó.</strong> Puedes consultar tus
            datos, pero no registrar operaciones nuevas.
            {dataRetentionUntil && <> Conservamos tu información hasta el {formatDate(dataRetentionUntil)}.</>}
          </>
        ) : status === "TRIALING" ? (
          <>
            <strong>Prueba gratuita:</strong> te {daysRemaining === 1 ? "queda" : "quedan"} {plural(daysRemaining, "día")}.
          </>
        ) : (
          <>
            Tu plan {plan.name} vence en {plural(daysRemaining, "día")}.
          </>
        )}
      </p>
      <Link
        href="/dashboard/suscripcion"
        className={cn(
          "rounded-lg px-3 py-1.5 text-xs font-bold",
          expired ? "bg-[#9b1f26] text-white" : "bg-white text-violet-strong shadow-sm",
        )}
      >
        {expired ? "Elegir un plan" : "Ver planes"}
      </Link>
    </div>
  );
}
