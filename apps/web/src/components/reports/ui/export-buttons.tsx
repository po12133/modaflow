import Link from "next/link";
import { FileSpreadsheet, FileText, Lock } from "lucide-react";
import { REQUIRED_PLAN } from "@/config/reports";
import { toQuery } from "@modaflow/ui/lib/query";

export function ExportButtons({ query, advanced }: { query: Record<string, string | undefined>; advanced: boolean }) {
  if (!advanced) {
    return (
      <Link href="/dashboard/suscripcion" className="inline-flex h-10 items-center gap-1.5 rounded-xl border bg-card px-3 text-sm font-semibold text-muted-foreground">
        <Lock className="size-4" aria-hidden="true" /> Exportar · plan {REQUIRED_PLAN}
      </Link>
    );
  }
  const href = (format: "xlsx" | "pdf") => `/api/reports/export${toQuery({ format, ...query })}`;
  const cls = "inline-flex h-10 items-center gap-1.5 rounded-xl border bg-card px-3 text-sm font-bold hover:border-ring";
  return (
    <div className="flex gap-2" role="group" aria-label="Exportar reporte">
      <a href={href("xlsx")} download className={cls}>
        <FileSpreadsheet className="size-4 text-[#0b7a66]" aria-hidden="true" /> Excel
      </a>
      <a href={href("pdf")} download className={cls}>
        <FileText className="size-4 text-destructive" aria-hidden="true" /> PDF
      </a>
    </div>
  );
}
