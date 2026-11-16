import { Panel } from "@modaflow/ui/components/panel";
import { formatTokens, formatUsd, modelLabel } from "@/lib/consumption-format";
import type { ConsumptionSummary } from "@/types/consumption";

export function ModelTable({ s }: { s: ConsumptionSummary }) {
  return (
    <Panel title="Por modelo">
      {s.byModel.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin análisis con IA en este periodo.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>{["Modelo", "Análisis", "Fallidos", "Entrada", "Salida", "Precio (USD / 1M)", "Costo"].map((h) => <th key={h} className="py-2 pr-3 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {s.byModel.map((m) => {
                const price = s.prices[m.model];
                return (
                  <tr key={m.model}>
                    <td className="py-2 pr-3 font-bold">{modelLabel(m.model)}</td>
                    <td className="py-2 pr-3">{m.analyses}</td>
                    <td className="py-2 pr-3">{m.failed}</td>
                    <td className="py-2 pr-3">{formatTokens(m.inputTokens)}</td>
                    <td className="py-2 pr-3">{formatTokens(m.outputTokens)}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{price ? `$${price.input} / $${price.output}` : "—"}</td>
                    <td className="py-2 pr-3 font-bold">{formatUsd(m.costUsd)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
