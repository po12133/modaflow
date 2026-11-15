import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { userStatusAction } from "@/actions/admin";
import { ActionDialog } from "@/components/action-dialog";
import { Panel } from "@modaflow/ui/components/panel";
import { ApiError } from "@/lib/api";
import { getMe } from "@/lib/dal";
import { formatDate, formatDateTime } from "@modaflow/ui/lib/format";
import { getAdminUser } from "@/services/admin";

export const metadata: Metadata = { title: "Usuario" };

export const instant = false;

export default async function UserPage({ params }: PageProps<"/usuarios/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [user, me] = await Promise.all([
    getAdminUser(id).catch((e: unknown) => {
      if (e instanceof ApiError && e.status === 404) notFound();
      throw e;
    }),
    getMe(),
  ]);
  const canEdit = me?.role === "SUPERADMIN";
  return (
    <div className="grid gap-4">
      <Link href="/usuarios" className="inline-flex items-center gap-1 justify-self-start text-sm font-semibold text-primary">
        <ChevronLeft className="size-4" aria-hidden="true" /> Usuarios
      </Link>
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">{user.name}</h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </header>
      {canEdit &&
        (user.status === "SUSPENDED" ? (
          <ActionDialog trigger="Reactivar acceso" title="Reactivar acceso" description="El usuario podrá iniciar sesión otra vez." confirm="Reactivar" action={userStatusAction.bind(null, user.id, "ACTIVE")} />
        ) : (
          <ActionDialog trigger="Suspender acceso" title="Suspender acceso" description="Se cierran sus sesiones y no podrá iniciar sesión. Sus negocios no se eliminan." confirm="Suspender" danger action={userStatusAction.bind(null, user.id, "SUSPENDED")} />
        ))}
      <Panel title="Datos">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div><dt className="text-xs text-muted-foreground">Estado</dt><dd className="font-bold">{user.status === "SUSPENDED" ? `Suspendido · ${user.suspendedReason ?? ""}` : "Activo"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Registro</dt><dd>{formatDate(user.createdAt)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Último acceso</dt><dd>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Sesiones activas</dt><dd>{user.activeSessions}</dd></div>
        </dl>
      </Panel>
      <Panel title="Negocios asociados">
        <ul className="divide-y text-sm">
          {user.memberships.map((m) => (
            <li key={m.tenant.id} className="flex justify-between py-2">
              <Link href={`/negocios/${m.tenant.id}`} className="font-bold text-primary">{m.tenant.name}</Link>
              <span className="text-xs font-semibold">{m.role}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <p className="text-xs text-muted-foreground">Las contraseñas no se ven ni se cambian desde aquí. El usuario puede recuperar el acceso con “¿Olvidaste tu contraseña?”.</p>
    </div>
  );
}
