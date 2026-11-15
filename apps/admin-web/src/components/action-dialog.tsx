"use client";

import { LoaderCircle } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@modaflow/ui/components/ui/dialog";
import { cn } from "@modaflow/ui/lib/utils";
import type { ActionResult } from "@modaflow/ui/types/actions";

interface ActionDialogProps {
  trigger: string;
  title: string;
  description: string;
  confirm: string;
  action: (form: FormData) => Promise<ActionResult<unknown>>;
  danger?: boolean;
  reasonLabel?: string;
  requireReason?: boolean;
  children?: ReactNode;
}

const field = "h-11 w-full rounded-xl border border-input bg-card px-3 text-base md:text-sm";

export function ActionDialog({ trigger, title, description, confirm, action, danger, reasonLabel = "Motivo", requireReason = true, children }: ActionDialogProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(form: FormData) {
    setError(null);
    start(async () => {
      const res = await action(form);
      if (res.ok) setOpen(false);
      else setError(res.message);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <DialogTrigger asChild>
        <button type="button" className={cn("h-10 rounded-xl border px-3 text-sm font-bold", danger ? "border-destructive/30 text-destructive" : "bg-card")}>
          {trigger}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {children}
          {requireReason && (
            <label className="grid gap-1 text-sm font-semibold">
              {reasonLabel}
              <textarea name="reason" required minLength={5} maxLength={500} rows={3} className={cn(field, "h-auto py-2")} />
            </label>
          )}
          {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <button type="button" className="h-11 rounded-xl border px-4 text-sm font-bold">
                Volver
              </button>
            </DialogClose>
            <button type="submit" disabled={pending} className={cn("inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white", danger ? "bg-destructive" : "bg-primary")}>
              {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
              {confirm}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export const dialogField = field;
