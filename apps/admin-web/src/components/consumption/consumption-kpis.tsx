import { KpiCard } from "@modaflow/ui/components/kpi-card";
import { formatBytes, formatTokens, formatUsd } from "@/lib/consumption-format";
import type { ConsumptionSummary } from "@/types/consumption";

export function ConsumptionKpis({ s }: { s: ConsumptionSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <KpiCard label="Costo estimado de IA" value={formatUsd(s.ai.costUsd)} tone="primary" hint={s.ai.unpricedModels.length ? `Sin precio: ${s.ai.unpricedModels.join(", ")}` : "Precio de lista de Claude"} />
      <KpiCard label="Análisis con IA" value={String(s.ai.analyses)} hint={`${s.ai.failed} fallidos (sin cobro al cliente)`} />
      <KpiCard label="Tokens de entrada" value={formatTokens(s.ai.inputTokens)} hint="Fotos e instrucciones" />
      <KpiCard label="Tokens de salida" value={formatTokens(s.ai.outputTokens)} hint="Respuesta de la IA" />
      <KpiCard label="Productos creados" value={String(s.products.created)} hint={`${s.products.deleted} eliminados en el periodo`} />
      <KpiCard label="Productos activos" value={String(s.products.active)} hint="Total actual" />
      <KpiCard label="Fotos guardadas" value={String(s.images.total)} hint={`${s.images.aiScanned} escaneadas con IA`} />
      <KpiCard label="Almacenamiento de fotos" value={formatBytes(s.images.bytes)} hint="Total actual, sin miniaturas" />
    </div>
  );
}
