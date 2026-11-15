import Link from "next/link";
import { formatDateTime } from "../lib/format";
import { cn } from "../lib/utils";
import type { AppNotification } from "../types/billing";

export function NotificationList({ items }: { items: AppNotification[] }) {
  if (items.length === 0) return <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">No tienes notificaciones.</p>;
  return (
    <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
      {items.map((n) => {
        const body = (
          <>
            <span className="flex items-center gap-2">
              {!n.readAt && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="No leída" />}
              <b className={cn(!n.readAt && "text-foreground")}>{n.title}</b>
            </span>
            <span className="block text-sm text-ink-2">{n.body}</span>
            <span className="block text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</span>
          </>
        );
        return (
          <li key={n.id} className={cn("grid gap-0.5 p-3.5", !n.readAt && "bg-secondary/40")}>
            {n.link ? (
              <Link href={n.link} className="grid gap-0.5">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}
