import type { Metadata } from "next";
import { InviteStaff } from "@/components/staff/invite-staff";
import { StaffRow } from "@/components/staff/staff-row";
import { requireStaff } from "@/lib/dal";
import { getStaff } from "@/services/admin";

export const metadata: Metadata = { title: "Equipo" };

export const instant = false;

export default async function TeamPage() {
  const [me, staff] = await Promise.all([requireStaff(), getStaff()]);
  const canEdit = me.role === "SUPERADMIN";
  const active = staff.filter((s) => s.status === "ACTIVE").length;
  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Equipo</h1>
          <p className="text-sm text-muted-foreground">Personas con acceso al panel de administración · {active} {active === 1 ? "activa" : "activas"} de {staff.length}. Son cuentas separadas de las de tiendas.</p>
        </div>
        {canEdit && <InviteStaff />}
      </header>
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
        {staff.map((s) => (
          <StaffRow key={s.id} s={s} isMe={s.id === me.id} canEdit={canEdit} />
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Las contraseñas no se ven ni se cambian desde aquí: cada persona la define con su enlace o la cambia en Mi cuenta. Todo cambio pide un motivo y queda en la auditoría.
        {!canEdit && " Tu rol de soporte solo permite consultar esta lista."}
      </p>
    </div>
  );
}
