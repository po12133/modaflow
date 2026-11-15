import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { Brand } from "@/components/brand";
import { LogoutButton } from "@/components/dashboard/common";
import { getMe } from "@/lib/dal";
import { getAdminPayments } from "@/services/admin";

export const metadata: Metadata = { title: { default: "Administración", template: "%s · Admin ModaFlow" }, robots: { index: false, follow: false } };

export const instant = false;

async function AdminShell({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect("/login");
  if (!me.user.globalRole) notFound();
  const pending = (await getAdminPayments({ status: "PENDING", pageSize: 1 })).pendingReview;
  return (
    <div className="min-h-dvh bg-[#f6f5fb] lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-4 overflow-y-auto border-r bg-white px-3 py-4 lg:flex">
        <Brand href="/admin" className="px-2" />
        <p className="px-2.5 text-[0.68rem] font-extrabold tracking-widest text-[#a29dbb] uppercase">Superadministración</p>
        <AdminNav variant="side" pendingPayments={pending} />
        <div className="mt-auto grid gap-2 border-t pt-4">
          <p className="truncate px-2 text-xs text-muted-foreground">{me.user.email} · {me.user.globalRole === "SUPERADMIN" ? "Superadministrador" : "Soporte (solo lectura)"}</p>
          <Link href="/dashboard" className="px-2 text-sm font-semibold text-primary">Ir al panel de tienda</Link>
          <LogoutButton />
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 grid gap-2 border-b bg-[#f6f5fb]/95 px-4 pt-3 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between">
            <Brand href="/admin" />
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-violet-strong">Admin</span>
          </div>
          <AdminNav variant="top" pendingPayments={pending} />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 lg:px-6">{children}</main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<div className="min-h-dvh animate-pulse bg-[#f6f5fb]" aria-busy="true" />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
