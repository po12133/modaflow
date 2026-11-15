import type { Metadata } from "next";
import { markNotificationReadAction } from "@/actions/subscription";
import { NotificationList } from "@modaflow/ui/components/notification-list";
import { PageHeader } from "@/components/dashboard/common";
import { Pagination } from "@modaflow/ui/components/pagination";
import { searchParam as one } from "@modaflow/ui/lib/search-params";
import { getNotifications } from "@/services/billing";

export const metadata: Metadata = { title: "Notificaciones" };

export const instant = false;

export default async function NotificationsPage({ searchParams }: PageProps<"/dashboard/notificaciones">) {
  const sp = await searchParams;
  const data = await getNotifications(Math.max(1, Number(one(sp.page)) || 1));
  return (
    <div className="grid gap-4">
      <PageHeader
        title="Notificaciones"
        description={data.unread ? `${data.unread} sin leer` : "Estás al día."}
        action={
          data.unread > 0 ? (
            <form action={markNotificationReadAction.bind(null, "all")}>
              <button type="submit" className="h-10 rounded-xl border bg-card px-3 text-sm font-bold">
                Marcar todas como leídas
              </button>
            </form>
          ) : undefined
        }
      />
      <NotificationList items={data.items} />
      <Pagination basePath="/dashboard/notificaciones" params={{}} page={data.page} totalPages={data.totalPages} total={data.total} noun="notificaciones" />
    </div>
  );
}
