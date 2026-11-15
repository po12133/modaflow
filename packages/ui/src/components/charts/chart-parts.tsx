import { cn } from "../../lib/utils";

export function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string; dashed?: boolean }[] }) {
  return (
    <div className="rounded-xl border bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-bold text-foreground">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2 text-ink-2">
          {r.color && <span aria-hidden="true" className={cn("inline-block h-0.5 w-3", r.dashed && "border-t-2 border-dashed bg-transparent")} style={r.dashed ? { borderColor: r.color } : { background: r.color, height: 8, borderRadius: 2 }} />}
          <span>{r.label}</span>
          <b className="ml-auto pl-3 text-foreground">{r.value}</b>
        </p>
      ))}
    </div>
  );
}

export function EmptyChart({ text }: { text: string }) {
  return <p className="grid min-h-28 place-items-center rounded-xl bg-muted/50 px-4 text-center text-sm text-muted-foreground">{text}</p>;
}

export function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <details className="text-xs">
      <summary className="cursor-pointer font-semibold text-primary">Ver como tabla</summary>
      <div className="mt-2 max-h-64 overflow-auto rounded-lg border">
        <table className="w-full">
          <thead className="sticky top-0 bg-muted text-left">
            <tr>
              {headers.map((h, i) => (
                <th key={h} className={cn("px-2 py-1.5 font-semibold", i > 0 && "text-right")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                {r.map((c, j) => (
                  <td key={j} className={cn("px-2 py-1", j > 0 && "text-right whitespace-nowrap")}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
