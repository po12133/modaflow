import Link from "next/link";
import { ImageOff } from "lucide-react";
import { formatDateTime } from "@modaflow/ui/lib/format";
import { cn } from "@modaflow/ui/lib/utils";
import { AI_STATUS, formatTokens, formatUsd, modelLabel } from "@/lib/consumption-format";
import type { AiLogItem } from "@/types/consumption";

function ProductLink({ product }: { product: AiLogItem["product"] }) {
  if (!product) return <span className="text-muted-foreground">No se guardó como producto</span>;
  return <span>{product.name}{product.status === "DELETED" && <span className="ml-1 text-xs font-bold text-destructive">(eliminado)</span>}</span>;
}

export function AiLogList({ items }: { items: AiLogItem[] }) {
  if (items.length === 0) return <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">No hay análisis con estos filtros.</p>;
  return (
    <ul className="divide-y overflow-hidden rounded-2xl border bg-card text-sm shadow-sm">
      {items.map((a) => {
        const status = AI_STATUS[a.status] ?? { label: a.status, tone: "bg-muted" };
        return (
          <li key={a.id} className="grid grid-cols-[56px_minmax(0,1fr)] gap-3 p-3.5 sm:grid-cols-[56px_minmax(0,1fr)_auto]">
            {a.thumbUrl ? (
              <a href={a.thumbUrl} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- S3 URL */}
                <img src={a.thumbUrl} alt="Foto escaneada" loading="lazy" className="size-14 rounded-xl border object-cover" /></a>
            ) : (
              <span className="grid size-14 place-items-center rounded-xl border bg-muted text-muted-foreground"><ImageOff className="size-5" aria-hidden="true" /></span>
            )}
            <div className="grid min-w-0 gap-0.5">
              <span className="flex flex-wrap items-center gap-2">
                <Link href={`/negocios/${a.tenant.id}`} className="font-bold text-primary hover:underline">{a.tenant.name}</Link>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", status.tone)}>{status.label}</span>
              </span>
              <span className="text-xs text-muted-foreground">{formatDateTime(a.createdAt)} · {a.user.name} · {a.imageCount} {a.imageCount === 1 ? "foto" : "fotos"} · {modelLabel(a.model)}</span>
              <span className="truncate"><ProductLink product={a.product} /></span>
              {a.errorCode && <span className="font-mono text-xs text-destructive">{a.errorCode}</span>}
            </div>
            <div className="col-span-2 flex gap-4 text-xs sm:col-span-1 sm:grid sm:justify-items-end sm:gap-0.5">
              <span><b>{formatTokens(a.inputTokens ?? 0)}</b> entrada · <b>{formatTokens(a.outputTokens ?? 0)}</b> salida</span>
              <span className="font-bold">{formatUsd(a.costUsd)}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
