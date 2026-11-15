import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { RequestList } from "@/components/catalog-admin/request-list";
import { PageHeader } from "@/components/dashboard/common";
import { Pagination } from "@/components/pagination";
import { REQUEST_STATUS_LABELS } from "@/config/catalog";
import { searchParam as one } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { getOrderRequests } from "@/services/catalog";

export const metadata: Metadata = { title: "Solicitudes del catálogo" };

export const instant = false;

export default async function RequestsPage({ searchParams }: PageProps<"/dashboard/catalogo/solicitudes">) {
  const sp = await searchParams;
  const status = one(sp.status);
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const data = await getOrderRequests({ status, page });
  const tabs: [string, string][] = [["", "Todas"], ...(Object.entries(REQUEST_STATUS_LABELS) as [string, string][])];
  return (
    <div className="grid gap-4">
      <Link href="/dashboard/catalogo" className="inline-flex items-center gap-1 justify-self-start text-sm font-semibold text-primary">
        <ChevronLeft className="size-4" aria-hidden="true" /> Catálogo
      </Link>
      <PageHeader title="Solicitudes de pedido" description="Consultas preparadas desde tu catálogo. No son ventas: regístralas en el punto de venta cuando se concreten." />
      <nav aria-label="Estado" className="-mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        {tabs.map(([v, l]) => (
          <Link key={v} href={v ? `?status=${v}` : "?"} className={cn("h-9 shrink-0 rounded-full border px-3.5 text-sm leading-9 font-semibold", (status ?? "") === v ? "border-foreground bg-foreground text-white" : "bg-card")}>
            {l}
          </Link>
        ))}
      </nav>
      <RequestList items={data.items} />
      <Pagination basePath="/dashboard/catalogo/solicitudes" params={{ status }} page={data.page} totalPages={data.totalPages} total={data.total} noun="solicitudes" />
    </div>
  );
}
