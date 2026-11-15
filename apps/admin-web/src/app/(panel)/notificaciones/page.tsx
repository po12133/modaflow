import type { Metadata } from "next";
import { runExpiryAction } from "@/actions/admin";
import { NotificationList } from "@modaflow/ui/components/notification-list";
import { Pagination } from "@modaflow/ui/components/pagination";
import { getMe } from "@/lib/dal";
import { searchParam as one } from "@modaflow/ui/lib/search-params";
import { getAdminNotifications } from "@/services/admin";

export const metadata: Metadata = { title: "Notificaciones" };

export const instant = false;

export default async function AdminNotificationsPage({ searchParams }: PageProps<"/notificaciones">) {
  const sp = await searchParams;
  const [data, me] = await Promise.all([getAdminNotifications(Math.max(1, Number(one(sp.page)) || 1)), getMe()]);
  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Notificaciones</h1>
          <p className="text-sm text-muted-foreground">{data.unread} sin leer · los correos se envían cuando hay SMTP configurado.</p>
        </div>
        {me?.role === "SUPERADMIN" && (
          <form action={runExpiryAction}>
            <button type="submit" className="h-10 rounded-xl border bg-card px-3 text-sm font-bold">Revisar vencimientos ahora</button>
          </form>
        )}
      </header>
      <NotificationList items={data.items} />
      <Pagination basePath="/notificaciones" params={{}} page={data.page} totalPages={data.totalPages} total={data.total} noun="notificaciones" />
    </div>
  );
}
