import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("grid min-w-0 content-start gap-3 rounded-2xl border bg-card p-4 shadow-sm", className)} aria-label={title}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-extrabold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
