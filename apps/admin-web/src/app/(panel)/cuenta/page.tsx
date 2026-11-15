import type { Metadata } from "next";
import { formatDateTime } from "@modaflow/ui/lib/format";
import { ChangePasswordForm } from "@/components/auth-forms";
import { STAFF_ROLE_LABELS } from "@/config/session";
import { requireStaff } from "@/lib/dal";

export const metadata: Metadata = { title: "Mi cuenta" };

export const instant = false;

export default async function AccountPage() {
  const me = await requireStaff();
  return (
    <div className="grid max-w-xl gap-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Mi cuenta</h1>
      <section className="grid gap-1 rounded-2xl border bg-card p-4 text-sm shadow-sm">
        <b className="text-base">{me.name}</b>
        <span>{me.email}</span>
        <span className="text-muted-foreground">{STAFF_ROLE_LABELS[me.role]} · último ingreso {me.lastLoginAt ? formatDateTime(me.lastLoginAt) : "—"}</span>
      </section>
      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <h2 className="mb-3 font-extrabold">Cambiar contraseña</h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
