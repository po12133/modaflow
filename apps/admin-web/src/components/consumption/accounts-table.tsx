import Link from "next/link";
import { formatBytes, formatTokens, formatUsd } from "@/lib/consumption-format";
import type { AccountUsage } from "@/types/consumption";

const HEADERS = ["Cuenta", "Análisis IA", "Tokens (entrada / salida)", "Costo IA", "Productos creados", "Eliminados", "Activos", "Fotos", "Ventas", ""];

export function AccountsTable({ items, query }: { items: AccountUsage[]; query: string }) {
  if (items.length === 0) return <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">No hay cuentas.</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
          <tr>{HEADERS.map((h) => <th key={h} className="px-3 py-2.5 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y">
          {items.map((r) => (
            <tr key={r.tenantId} className="hover:bg-muted/40">
              <td className="px-3 py-2.5">
                <Link href={`/negocios/${r.tenantId}`} className="font-bold text-primary hover:underline">{r.name}</Link>
                <span className="block text-xs text-muted-foreground">{r.plan ?? "Sin plan"}</span>
              </td>
              <td className="px-3 py-2.5">{r.ai.analyses}{r.ai.failed ? <span className="text-xs text-muted-foreground"> · {r.ai.failed} fallidos</span> : null}</td>
              <td className="px-3 py-2.5">{formatTokens(r.ai.inputTokens)} / {formatTokens(r.ai.outputTokens)}</td>
              <td className="px-3 py-2.5 font-bold">{formatUsd(r.ai.costUsd)}</td>
              <td className="px-3 py-2.5">{r.products.created}</td>
              <td className="px-3 py-2.5">{r.products.deleted}</td>
              <td className="px-3 py-2.5">{r.products.active}</td>
              <td className="px-3 py-2.5">{r.images.total} <span className="text-xs text-muted-foreground">({formatBytes(r.images.bytes)})</span></td>
              <td className="px-3 py-2.5">{r.sales}</td>
              <td className="px-3 py-2.5">
                <Link href={`/consumo/ia?tenantId=${r.tenantId}&${query}`} className="text-xs font-bold whitespace-nowrap text-primary hover:underline">Ver registro IA</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
