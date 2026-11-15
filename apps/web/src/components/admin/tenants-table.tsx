import Link from "next/link";
import { formatDate } from "@/lib/format";
import type { AdminTenantRow } from "@/types/admin";
import { SubscriptionBadge } from "./status-badge";

export function TenantsTable({ items }: { items: AdminTenantRow[] }) {
  if (items.length === 0) return <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">No hay negocios con estos filtros.</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
          <tr>
            {["Negocio", "Propietario", "WhatsApp", "Ciudad", "Plan", "Estado", "Registro", "Vence"].map((h) => (
              <th key={h} className="px-3 py-2.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((t) => (
            <tr key={t.id} className="hover:bg-muted/40">
              <td className="px-3 py-2.5 font-bold">
                <Link href={`/admin/negocios/${t.id}`} className="text-primary hover:underline">
                  {t.name}
                </Link>
              </td>
              <td className="px-3 py-2.5">
                <span className="block">{t.owner?.name ?? "—"}</span>
                <span className="block text-xs text-muted-foreground">{t.owner?.email}</span>
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap">{t.whatsapp ?? "—"}</td>
              <td className="px-3 py-2.5">{t.city ?? "—"}</td>
              <td className="px-3 py-2.5">{t.plan?.name ?? "—"}</td>
              <td className="px-3 py-2.5">
                <SubscriptionBadge status={t.status} />
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(t.createdAt)}</td>
              <td className="px-3 py-2.5 whitespace-nowrap">{t.expiresAt ? formatDate(t.expiresAt) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
