"use client";

import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  name: string;
  state?: FormState;
  hint?: ReactNode;
  optional?: boolean;
  className?: string;
  children?: (props: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => ReactNode;
}

/** Label + control + hint + server/client error, wired for screen readers. */
export function Field({ label, name, state, hint, optional, className, children }: FieldProps) {
  // Deterministic id (field names are unique per page); useId can differ between
  // the prerendered shell and the client when Suspense siblings are present.
  const id = `field-${name}`;
  const errors = state?.fieldErrors?.[name];
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = errors?.length ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id} className="text-sm font-semibold text-ink-2">
        {label}
        {optional && <span className="font-normal text-muted-foreground">(opcional)</span>}
      </Label>
      {children?.({ id, "aria-invalid": errors?.length ? true : undefined, "aria-describedby": describedBy })}
      {errors?.length ? (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {errors[0]}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type TextFieldProps = Omit<FieldProps, "children"> &
  Omit<ComponentProps<typeof Input>, "name" | "id">;

export function TextField({ label, name, state, hint, optional, className, defaultValue, ...input }: TextFieldProps) {
  return (
    <Field label={label} name={name} state={state} hint={hint} optional={optional} className={className}>
      {(a11y) => (
        <Input
          name={name}
          defaultValue={state?.values?.[name] ?? defaultValue}
          required={!optional}
          className="h-11 text-base md:h-10 md:text-sm"
          {...a11y}
          {...input}
        />
      )}
    </Field>
  );
}

type TextAreaFieldProps = Omit<FieldProps, "children"> & Omit<ComponentProps<typeof Textarea>, "name" | "id">;

export function TextAreaField({ label, name, state, hint, optional, className, defaultValue, ...rest }: TextAreaFieldProps) {
  return (
    <Field label={label} name={name} state={state} hint={hint} optional={optional} className={className}>
      {(a11y) => (
        <Textarea
          name={name}
          defaultValue={state?.values?.[name] ?? defaultValue}
          required={!optional}
          className="min-h-20 text-base md:text-sm"
          {...a11y}
          {...rest}
        />
      )}
    </Field>
  );
}

export function SubmitButton({
  pending,
  children,
  pendingText = "Guardando…",
  className,
  ...props
}: ComponentProps<typeof Button> & { pending: boolean; pendingText?: string }) {
  return (
    <Button type="submit" size="lg" disabled={pending} aria-busy={pending} className={cn("h-11", className)} {...props}>
      {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
      {pending ? pendingText : children}
    </Button>
  );
}

/** Form-level result message (success or error), announced to screen readers. */
export function FormMessage({ state }: { state?: FormState }) {
  if (!state?.message) return null;
  const ok = state.ok === true;
  return (
    <Alert
      role={ok ? "status" : "alert"}
      className={cn(
        ok ? "border-mint/30 bg-mint/10 text-[#0b7a66]" : "border-destructive/30 bg-destructive/5 text-destructive",
      )}
    >
      {ok ? <CircleCheck aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}
      <AlertDescription className="text-current">{state.message}</AlertDescription>
    </Alert>
  );
}
