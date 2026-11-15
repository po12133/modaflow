import { staffRoleAction, staffStatusAction } from "@/actions/staff";
import { ActionDialog } from "@/components/action-dialog";
import { STAFF_ROLE_LABELS } from "@/config/session";
import { formatDateTime } from "@modaflow/ui/lib/format";
import { cn } from "@modaflow/ui/lib/utils";
import type { StaffMember } from "@/types/staff";
import { NewLinkButton } from "./new-link-button";

const badge = "rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap";

function StateBadge({ s }: { s: StaffMember }) {
  if (s.status === "DISABLED") return <span className={cn(badge, "bg-muted text-ink-2")}>Desactivado</span>;
  if (!s.hasPassword) return <span className={cn(badge, "bg-amber/15 text-[#8a5a00]")}>Invitación pendiente</span>;
  if (s.lockedUntil && new Date(s.lockedUntil) > new Date()) return <span className={cn(badge, "bg-destructive/10 text-destructive")}>Bloqueado temporalmente</span>;
  return <span className={cn(badge, "bg-mint/15 text-[#0b7a66]")}>Activo</span>;
}

export function StaffRow({ s, isMe, canEdit }: { s: StaffMember; isMe: boolean; canEdit: boolean }) {
  const otherRole = s.role === "SUPERADMIN" ? "SUPPORT" : "SUPERADMIN";
  return (
    <li className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div className="grid min-w-0 gap-1">
        <p className="flex flex-wrap items-center gap-2">
          <b className="truncate">{s.name}</b>
          {isMe && <span className={cn(badge, "bg-secondary text-violet-strong")}>Tú</span>}
          <span className={cn(badge, s.role === "SUPERADMIN" ? "bg-primary/10 text-violet-strong" : "bg-muted text-ink-2")}>{STAFF_ROLE_LABELS[s.role]}</span>
          <StateBadge s={s} />
        </p>
        <p className="truncate text-sm text-muted-foreground">{s.email}</p>
        <p className="text-xs text-ink-2">
          Último ingreso {s.lastLoginAt ? formatDateTime(s.lastLoginAt) : "nunca"} · {s.activeSessions} {s.activeSessions === 1 ? "sesión abierta" : "sesiones abiertas"} · alta {formatDateTime(s.createdAt)}
        </p>
      </div>
      {canEdit && !isMe && (
        <div className="flex flex-wrap gap-2">
          {s.status === "ACTIVE" && <NewLinkButton id={s.id} name={s.name} pendingSetup={!s.hasPassword} />}
          {s.status === "ACTIVE" && (
            <ActionDialog
              trigger={otherRole === "SUPERADMIN" ? "Hacer superadmin" : "Pasar a soporte"}
              title={`Cambiar rol de ${s.name}`}
              description={otherRole === "SUPERADMIN" ? "Podrá aprobar pagos, cambiar planes, configuración y gestionar al equipo." : "Solo podrá consultar el panel, sin hacer cambios."}
              confirm="Cambiar rol"
              action={staffRoleAction.bind(null, s.id, otherRole)}
            />
          )}
          {s.status === "ACTIVE" ? (
            <ActionDialog trigger="Desactivar" title={`Desactivar a ${s.name}`} description="Se cierran sus sesiones y ya no podrá ingresar. Su historial y auditoría se conservan." confirm="Desactivar" danger action={staffStatusAction.bind(null, s.id, "DISABLED")} />
          ) : (
            <ActionDialog trigger="Reactivar" title={`Reactivar a ${s.name}`} description="Podrá volver a ingresar con su contraseña. Si no la recuerda, genera un enlace nuevo." confirm="Reactivar" action={staffStatusAction.bind(null, s.id, "ACTIVE")} />
          )}
        </div>
      )}
    </li>
  );
}
