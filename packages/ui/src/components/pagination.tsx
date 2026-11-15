import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";

/** Server-rendered pagination that preserves the current filters in the URL. */
export function Pagination({
  basePath,
  params,
  page,
  totalPages,
  total,
  noun = "resultados",
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  totalPages: number;
  total: number;
  noun?: string;
}) {
  const href = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "page") qs.set(k, v);
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const linkClass = "inline-flex h-10 items-center gap-1 rounded-xl border bg-card px-3 text-sm font-semibold";
  return (
    <nav aria-label="Paginación" className="mt-4 flex items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground">
        {total} {total === 1 ? noun.replace(/s$/, "") : noun} · página {page} de {totalPages}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={linkClass} rel="prev">
            <ChevronLeft className="size-4" aria-hidden="true" /> Anterior
          </Link>
        ) : (
          <span className={cn(linkClass, "opacity-40")} aria-disabled="true">
            <ChevronLeft className="size-4" aria-hidden="true" /> Anterior
          </span>
        )}
        {page < totalPages ? (
          <Link href={href(page + 1)} className={linkClass} rel="next">
            Siguiente <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        ) : (
          <span className={cn(linkClass, "opacity-40")} aria-disabled="true">
            Siguiente <ChevronRight className="size-4" aria-hidden="true" />
          </span>
        )}
      </div>
    </nav>
  );
}
