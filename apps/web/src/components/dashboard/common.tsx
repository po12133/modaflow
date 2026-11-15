import Link from "next/link";
import type { ReactNode } from "react";
import { Construction, LogOut } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { initials } from "@modaflow/ui/lib/format";
import { cn } from "@modaflow/ui/lib/utils";

export function PageHeader({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </header>
  );
}

/** Store avatar: initials on the store's primary color. */
export function StoreAvatar({ name, color, className }: { name: string; color: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("grid size-10 shrink-0 place-items-center rounded-full text-sm font-extrabold text-white", className)}
      style={{ backgroundColor: color }}
    >
      {initials(name) || "T"}
    </span>
  );
}

export function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-semibold text-ink-2 hover:bg-muted hover:text-destructive",
          className,
        )}
      >
        <LogOut className="size-[18px] text-[#8f8aa8]" aria-hidden="true" />
        Cerrar sesión
      </button>
    </form>
  );
}

/** Placeholder for sections planned for the next stages. Never shows fake data. */
export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <section className="grid place-items-center rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-secondary text-primary">
        <Construction className="size-7" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-lg font-extrabold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      <span className="mt-4 rounded-full bg-amber/15 px-3 py-1 text-xs font-bold text-[#a2620a]">En desarrollo</span>
      <Link href="/dashboard" className="mt-6 text-sm font-bold text-primary hover:underline">
        Volver al inicio
      </Link>
    </section>
  );
}
