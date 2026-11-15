import Link from "next/link";
import { LogoMark } from "@modaflow/ui/components/brand";
import type { PublicStore } from "@/types/catalog";

export function StoreFooter({ store }: { store: PublicStore }) {
  return (
    <footer className="mt-10 border-t bg-white pb-24 lg:pb-8">
      <div className="mx-auto grid max-w-6xl gap-2 px-4 py-6 text-sm text-muted-foreground">
        <p>
          <b className="text-foreground">{store.name}</b> · {store.city}
          {store.address ? ` · ${store.address}` : ""}
        </p>
        <p>Los precios son referenciales. La disponibilidad se confirma por WhatsApp con la tienda.</p>
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs">
          <LogoMark className="size-4" /> Catálogo creado con ModaFlow
        </Link>
      </div>
    </footer>
  );
}
