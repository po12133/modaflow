"use client";

import { Ban, LoaderCircle, TriangleAlert } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { cancelSaleAction } from "@/actions/sales";
import { Button } from "@modaflow/ui/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@modaflow/ui/components/ui/dialog";
import { Input } from "@modaflow/ui/components/ui/input";
import { Label } from "@modaflow/ui/components/ui/label";
import { Textarea } from "@modaflow/ui/components/ui/textarea";

/** Owner-only cancellation with a reason. Restores stock; money refunds are handled separately. */
export function CancelSaleDialog({ saleId, number, units }: { saleId: string; number: string; units: number }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const key = useRef("");

  function onOpenChange(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (next) {
      key.current = crypto.randomUUID().replace(/-/g, "");
      setError(null);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await cancelSaleAction({ id: saleId, reason, notes, idempotencyKey: key.current });
      if (!result.ok) setError(result.message);
      else setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="h-11 text-destructive">
          <Ban aria-hidden="true" /> Anular venta
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>¿Anular la venta {number}?</DialogTitle>
            <DialogDescription>
              La venta queda registrada como anulada y se devuelven {units} {units === 1 ? "prenda" : "prendas"} al inventario.
            </DialogDescription>
          </DialogHeader>
          <p className="flex items-start gap-2 rounded-xl bg-amber/10 px-3 py-2 text-sm font-semibold text-[#7a4f00]">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Anular no devuelve el dinero automáticamente: la devolución al cliente se gestiona por separado.
          </p>
          <div className="grid gap-1.5">
            <Label htmlFor="cancel-reason">Motivo</Label>
            <Input id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} required minLength={3} placeholder="Ej. Se registró una talla equivocada" className="h-11 text-base md:text-sm" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cancel-notes">
              Observaciones <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea id="cancel-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} className="min-h-16 text-base md:text-sm" />
          </div>
          {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" size="lg" className="h-11">Volver</Button>
            </DialogClose>
            <Button type="submit" size="lg" className="h-11 bg-destructive text-white hover:bg-destructive/90" disabled={pending || reason.trim().length < 3}>
              {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
              Anular venta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
