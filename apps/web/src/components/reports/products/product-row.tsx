import Link from "next/link";
import { ImageOff } from "lucide-react";
import { formatMoney, plural } from "@/lib/format";
import type { ProductReportRow } from "@/types/reports";

function Profit({ row }: { row: ProductReportRow }) {
  const p = row.profit;
  if (p.complete) return <span>{formatMoney(p.grossProfit)}</span>;
  if (p.knownRevenue === "0.00") return <span className="text-muted-foreground">Sin costo registrado</span>;
  return (
    <span title={`${p.unitsWithoutCost} prendas sin costo registrado`}>
      {formatMoney(p.grossProfit)} <span className="text-xs text-muted-foreground">(parcial)</span>
    </span>
  );
}

function Thumb({ url }: { url: string | null }) {
  if (!url) {
    return (
      <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
        <ImageOff className="size-4" aria-hidden="true" />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- signed S3 URL
  return <img src={url} alt="" loading="lazy" className="size-12 shrink-0 rounded-lg bg-muted object-cover" />;
}

export function ProductRow({ row, rank, variantsHref }: { row: ProductReportRow; rank: number; variantsHref: string }) {
  return (
    <li className="grid grid-cols-[auto_1fr] gap-3 p-3 sm:grid-cols-[auto_1fr_auto]">
      <div className="flex items-center gap-2">
        <span className="w-5 text-right text-xs font-bold text-muted-foreground">{rank}</span>
        <Thumb url={row.thumbUrl} />
      </div>
      <div className="min-w-0">
        <Link href={`/dashboard/productos/${row.productId}`} className="block truncate font-bold hover:text-primary">
          {row.name}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {row.category ?? "Sin categoría"} · {plural(row.sales, "venta")}
          {row.status === "ARCHIVED" ? " · archivado" : ""}
        </p>
        <Link href={variantsHref} className="text-xs font-semibold text-primary">
          Ver variantes
        </Link>
      </div>
      <dl className="col-span-2 grid grid-cols-3 gap-2 text-xs sm:col-span-1 sm:min-w-72 sm:text-right">
        <div>
          <dt className="text-muted-foreground">Prendas</dt>
          <dd className="text-sm font-extrabold">{row.units}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Ingresos</dt>
          <dd className="text-sm font-extrabold whitespace-nowrap">{formatMoney(row.revenue)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Ganancia est.</dt>
          <dd className="text-sm font-semibold">
            <Profit row={row} />
          </dd>
        </div>
      </dl>
    </li>
  );
}
