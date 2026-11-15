"use client";

import { LoaderCircle, UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@modaflow/ui/components/ui/dialog";
import { inviteStaffAction } from "@/actions/staff";
import { dialogField } from "@/components/action-dialog";
import type { SetupLink } from "@/types/staff";
import { SetupLinkBox } from "./setup-link-box";

export function InviteStaff() {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<(SetupLink & { email: string }) | null>(null);
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

  function submit(form: FormData) {
    setError(null);
    start(async () => {
      const res = await inviteStaffAction(form);
      if (res.ok) setLink(res.data);
      else setError(res.message);
    });
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger asChild>
        <button type="button" className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-bold text-white">
          <UserPlus className="size-4" aria-hidden="true" /> Invitar al equipo
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invitar al equipo</DialogTitle>
          <DialogDescription>La persona recibe un enlace para elegir su contraseña. No uses correos de cuentas de tiendas: son sistemas separados.</DialogDescription>
        </DialogHeader>
        {link ? (
          <div className="grid gap-3">
            <p className="text-sm">Invitación creada para <b>{link.email}</b>.</p>
            <SetupLinkBox link={link} />
            <button type="button" onClick={() => change(false)} className="h-11 rounded-xl border text-sm font-bold">Listo</button>
          </div>
        ) : (
          <form action={submit} className="grid gap-3">
            <label className="grid gap-1 text-sm font-semibold">Nombre completo<input name="name" required minLength={2} maxLength={120} className={dialogField} /></label>
            <label className="grid gap-1 text-sm font-semibold">Correo<input name="email" type="email" required maxLength={254} className={dialogField} /></label>
            <label className="grid gap-1 text-sm font-semibold">
              Rol
              <select name="role" defaultValue="SUPPORT" className={dialogField}>
                <option value="SUPPORT">Soporte (solo lectura)</option>
                <option value="SUPERADMIN">Superadministrador</option>
              </select>
            </label>
            {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
            <button type="submit" disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white">
              {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
              Crear invitación
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
