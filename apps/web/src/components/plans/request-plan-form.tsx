"use client";

import { useActionState } from "react";
import { requestPlanChangeAction } from "@/actions/subscription";
import { FormMessage, SubmitButton, TextAreaField } from "@/components/form";
import { formatPrice } from "@/lib/format";
import type { FormState, Plan } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Lets the owner request a paid plan. Nothing is charged or activated here. */
export function RequestPlanForm({ plans, defaultPlan }: { plans: Plan[]; defaultPlan?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(requestPlanChangeAction, {});
  const selected = state.values?.planCode ?? defaultPlan;

  if (state.ok) return <FormMessage state={state} />;

  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-semibold text-ink-2">¿Qué plan quieres?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {plans.map((plan) => (
            <label
              key={plan.code}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-3 has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
              )}
            >
              <input
                type="radio"
                name="planCode"
                value={plan.code}
                defaultChecked={plan.code === selected}
                required
                className="size-4 accent-[#6c4cf5]"
              />
              <span className="min-w-0">
                <span className="block font-bold">
                  {plan.name}
                  {plan.isRecommended && <span className="ml-1.5 text-xs font-bold text-primary">Recomendado</span>}
                </span>
                <span className="block text-xs text-muted-foreground">{formatPrice(plan.priceCents)}/mes</span>
              </span>
            </label>
          ))}
        </div>
        {state.fieldErrors?.planCode && (
          <p className="text-xs font-medium text-destructive">{state.fieldErrors.planCode[0]}</p>
        )}
      </fieldset>
      <TextAreaField
        label="Comentario"
        name="note"
        optional
        maxLength={500}
        placeholder="Ej. Prefiero pagar por QR"
        state={state}
      />
      <SubmitButton pending={pending} pendingText="Enviando…" className="w-full sm:w-auto sm:justify-self-start">
        Solicitar cambio de plan
      </SubmitButton>
      <p className="text-xs text-muted-foreground">
        Todavía no hay pagos en línea: el equipo de ModaFlow te contactará para coordinar el pago y activar el plan.
      </p>
    </form>
  );
}
