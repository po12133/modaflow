import Link from "next/link";
import { SearchX } from "lucide-react";

export default function ProductUnavailable() {
  return (
    <section className="grid justify-items-center gap-3 py-16 text-center">
      <SearchX className="size-10 text-muted-foreground" aria-hidden="true" />
      <h1 className="text-lg font-extrabold">Esta prenda ya no está disponible</h1>
      <p className="max-w-sm text-sm text-muted-foreground">Puede que se haya vendido o que la tienda la haya ocultado.</p>
      <Link href="./" className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-bold text-[var(--brand-ink)]">
        Ver el catálogo
      </Link>
    </section>
  );
}
