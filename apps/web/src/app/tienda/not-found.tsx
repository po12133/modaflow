import Link from "next/link";
import { Store } from "lucide-react";
import { LogoMark } from "@modaflow/ui/components/brand";

export default function CatalogUnavailable() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#fbf8f6] px-6 text-center">
      <div className="grid max-w-sm justify-items-center gap-3">
        <span className="grid size-16 place-items-center rounded-2xl bg-white text-muted-foreground shadow-sm">
          <Store className="size-8" aria-hidden="true" />
        </span>
        <h1 className="text-xl font-extrabold">Catálogo no disponible</h1>
        <p className="text-sm text-muted-foreground">Este catálogo no está disponible en este momento. Si conoces a la tienda, contáctala directamente.</p>
        <Link href="/" className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <LogoMark className="size-4" /> ModaFlow
        </Link>
      </div>
    </main>
  );
}
