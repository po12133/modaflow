import { ShieldCheck } from "lucide-react";
import { Brand } from "@modaflow/ui/components/brand";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#f6f5fb] px-4 py-8">
      <div className="w-full max-w-md rounded-3xl border bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Brand href="/login" />
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-bold whitespace-nowrap text-violet-strong">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Solo equipo
          </span>
        </div>
        {children}
      </div>
    </main>
  );
}
