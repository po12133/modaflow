"use client";

import { LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@modaflow/ui/components/ui/dialog";
import { staffSetupLinkAction } from "@/actions/staff";
import type { SetupLink } from "@/types/staff";
import { SetupLinkBox } from "./setup-link-box";

export function NewLinkButton({ id, name, pendingSetup }: { id: string; name: string; pendingSetup: boolean }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<SetupLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function change(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (!next) {
      setLink(null);
      setError(null);
    }
  }

  function generate() {
    setError(null);
    start(async () => {
      const res = await staffSetupLinkAction(id);
      if (res.ok) setLink(res.data);
      else setError(res.message);
    });
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger asChild>
        <button type="button" className="h-10 rounded-xl border bg-card px-3 text-sm font-bold">{pendingSetup ? "Reenviar enlace" : "Enlace de contraseña"}</button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enlace para {name}</DialogTitle>
          <DialogDescription>Se invalida cualquier enlace anterior y se cierran sus sesiones abiertas. Úsalo si olvidó su contraseña o no recibió la invitación.</DialogDescription>
        </DialogHeader>
        {link ? (
          <SetupLinkBox link={link} />
        ) : (
          <div className="grid gap-3">
            {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
            <button type="button" onClick={generate} disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white">
              {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
              Generar enlace nuevo
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
