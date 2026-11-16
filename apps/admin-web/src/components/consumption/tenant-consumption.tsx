import Link from "next/link";
import { Panel } from "@modaflow/ui/components/panel";
import { formatBytes, formatTokens, formatUsd } from "@/lib/consumption-format";
import type { TenantConsumption as Usage } from "@/types/consumption";

export function TenantConsumption({ tenantId, usage }: { tenantId: string; usage: Usage }) {
  const rows: [string, string][] = [
    ["Productos creados", String(usage.products.created)],
    ["Productos activos", String(usage.products.active)],
    ["Productos eliminados", String(usage.products.deleted)],
    ["Ventas registradas", String(usage.completedSales)],
    ["Análisis con IA", `${usage.ai.analyses}${usage.ai.failed ? ` (+${usage.ai.failed} fallidos)` : ""}`],
    ["Tokens entrada / salida", `${formatTokens(usage.ai.inputTokens)} / ${formatTokens(usage.ai.outputTokens)}`],
    ["Costo estimado de IA", formatUsd(usage.ai.costUsd)],
    ["Fotos guardadas", `${usage.images.total} (${usage.images.aiScanned} con IA)`],
    ["Almacenamiento", formatBytes(usage.images.bytes)],
  ];
  return (
    <Panel title="Consumo histórico" action={<Link href={`/consumo/ia?tenantId=${tenantId}&period=this_year`} className="text-xs font-bold text-primary hover:underline">Registro de IA</Link>}>
      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-bold">{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
