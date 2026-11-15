import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { SubscriptionActions } from "@/components/admin/subscription-actions";
import { TenantHistory } from "@/components/admin/tenant-history";
import { TenantOverview } from "@/components/admin/tenant-overview";
import { ApiError } from "@/lib/api";
import { getMe } from "@/lib/dal";
import { getAdminPlans, getAdminTenant } from "@/services/admin";

export const metadata: Metadata = { title: "Negocio" };

export const instant = false;

export default async function TenantPage({ params }: PageProps<"/admin/negocios/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [tenant, plans, me] = await Promise.all([
    getAdminTenant(id).catch((e: unknown) => {
      if (e instanceof ApiError && e.status === 404) notFound();
      throw e;
    }),
    getAdminPlans(),
    getMe(),
  ]);
  const owner = tenant.memberships.find((m) => m.role === "OWNER")?.user;
  return (
    <div className="grid gap-4">
      <Link href="/admin/negocios" className="inline-flex items-center gap-1 justify-self-start text-sm font-semibold text-primary">
        <ChevronLeft className="size-4" aria-hidden="true" /> Negocios
      </Link>
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">{tenant.name}</h1>
        {owner && <p className="text-sm text-muted-foreground">{owner.name} · {owner.email}</p>}
      </header>
      {me?.user.globalRole === "SUPERADMIN" && <SubscriptionActions tenant={tenant} plans={plans} />}
      <TenantOverview tenant={tenant} />
      <TenantHistory tenant={tenant} />
    </div>
  );
}
