"use client";

import { ArrowDownToLine, ArrowUpFromLine, LoaderCircle, Scale } from "lucide-react";
import { useState, useTransition } from "react";
import { stockMovementAction } from "@/actions/products";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { variantLabel } from "@/lib/format";
import type { Variant } from "@/lib/types";
import { cn } from "@/lib/utils";

type Kind = "entry" | "exit" | "adjust_in" | "adjust_out";

const KINDS: { value: Kind; label: string; admin?: boolean }[] = [
  { value: "entry", label: "Entrada" },
  { value: "exit", label: "Salida" },
  { value: "adjust_in", label: "Ajuste +", admin: true },
  { value: "adjust_out", label: "Ajuste −", admin: true },
];


/** Registers an inventory movement for one variant. Stock is never edited directly. */
export function MovementDialog({
  variants,
  defaultVariantId,
  defaultKind = "entry",
  canAdjust,
  trigger,
  disabled,
}: {
  variants: Variant[];
  defaultVariantId?: string;
  defaultKind?: Kind;
  canAdjust: boolean;
  trigger: React.ReactNode;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>(defaultKind);
  const [variantId, setVariantId] = useState(defaultVariantId ?? variants[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const variant = variants.find((v) => v.id === variantId);
  const decreases = kind === "exit" || kind === "adjust_out";
  const after = variant ? variant.stock + (decreases ? -quantity : quantity) : 0;

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      // New key per dialog opening: double taps or retries never apply it twice.
      setIdempotencyKey(crypto.randomUUID().replace(/-/g, ""));
      setKind(defaultKind);
      setVariantId(defaultVariantId ?? variants[0]?.id ?? "");
      setQuantity(1);
      setReason("");
      setReference("");
      setErrors({});
      setMessage(null);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setMessage(null);
    startTransition(async () => {
      const result = await stockMovementAction({ kind, variantId, quantity, reason, reference, idempotencyKey });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setMessage(result.message);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild disabled={disabled}>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Movimiento de stock</DialogTitle>
            <DialogDescription>Queda registrado en el historial con tu nombre y la fecha.</DialogDescription>
          </DialogHeader>

          <div className={cn("grid gap-1 rounded-xl bg-muted p-1", canAdjust ? "grid-cols-4" : "grid-cols-2")} role="radiogroup" aria-label="Tipo de movimiento">
            {KINDS.filter((k) => canAdjust || !k.admin).map((k) => (
              <button
                key={k.value}
                type="button"
                role="radio"
                aria-checked={kind === k.value}
                onClick={() => setKind(k.value)}
                className={cn("rounded-lg px-1 py-2 text-xs font-bold sm:text-sm", kind === k.value ? "bg-white text-violet-strong shadow-sm" : "text-ink-2")}
              >
                {k.label}
              </button>
            ))}
          </div>

          {variants.length > 1 && (
            <div className="grid gap-1.5">
              <Label htmlFor="mv-variant">Talla / color</Label>
              <select id="mv-variant" value={variantId} onChange={(e) => setVariantId(e.target.value)} className="h-11 rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm">
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {variantLabel(v)} — {v.stock} en stock
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="mv-qty">Cantidad</Label>
            <Input id="mv-qty" type="number" inputMode="numeric" min={1} max={100000} value={quantity} onChange={(e) => setQuantity(Math.max(0, Math.trunc(Number(e.target.value) || 0)))} className="h-11 text-base md:text-sm" aria-invalid={Boolean(errors.quantity)} />
            {errors.quantity && <p className="text-xs font-medium text-destructive">{errors.quantity[0]}</p>}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="mv-reason">
              Motivo {kind === "entry" && <span className="font-normal text-muted-foreground">(opcional)</span>}
            </Label>
            <Input id="mv-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder={kind === "entry" ? "Ej. Llegó mercadería" : kind === "exit" ? "Ej. Prenda dañada" : "Ej. Conteo físico"} className="h-11 text-base md:text-sm" aria-invalid={Boolean(errors.reason)} />
            {errors.reason && <p className="text-xs font-medium text-destructive">{errors.reason[0]}</p>}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="mv-ref">
              Referencia <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input id="mv-ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={80} placeholder="Ej. Nota de compra 123" className="h-11 text-base md:text-sm" />
          </div>

          {variant && (
            <p className={cn("rounded-xl px-3 py-2 text-sm font-semibold", after < 0 ? "bg-destructive/10 text-destructive" : "bg-secondary text-violet-strong")} aria-live="polite">
              Stock: {variant.stock} → {after < 0 ? "no alcanza" : after}
            </p>
          )}
          {message && (
            <p role="alert" className="text-sm font-semibold text-destructive">
              {message}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" size="lg" className="h-11 w-full font-bold" disabled={pending || quantity < 1 || after < 0}>
              {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : decreases ? <ArrowUpFromLine aria-hidden="true" /> : kind === "entry" ? <ArrowDownToLine aria-hidden="true" /> : <Scale aria-hidden="true" />}
              {pending ? "Registrando…" : "Registrar movimiento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
