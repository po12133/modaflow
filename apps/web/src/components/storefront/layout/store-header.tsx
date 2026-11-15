import Link from "next/link";
import { WhatsAppIcon } from "@/components/common/whatsapp-icon";
import { initials } from "@/lib/format";
import { whatsappLink } from "@/lib/catalog";
import type { PublicStore } from "@/types/catalog";
import { CartLink } from "./cart-link";
import { StoreNav } from "./store-nav";

export function StoreLogo({ store, className = "size-11" }: { store: PublicStore; className?: string }) {
  if (store.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- signed S3 URL
    return <img src={store.logoUrl} alt={`Logo de ${store.name}`} className={`${className} shrink-0 rounded-full border bg-white object-cover`} />;
  }
  return (
    <span className={`${className} grid shrink-0 place-items-center rounded-full bg-[var(--brand)] text-sm font-extrabold text-[var(--brand-ink)]`} aria-hidden="true">
      {initials(store.name)}
    </span>
  );
}

export function StoreHeader({ store }: { store: PublicStore }) {
  const base = `/tienda/${store.slug}`;
  return (
    <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        <Link href={base} className="flex min-w-0 items-center gap-2.5">
          <StoreLogo store={store} />
          <span className="min-w-0">
            <b className="block truncate text-lg leading-tight font-extrabold">{store.name}</b>
            <small className="block truncate text-xs text-muted-foreground">{store.city}</small>
          </span>
        </Link>
        <StoreNav base={base} variant="top" />
        <a
          href={whatsappLink(store.whatsapp, `Hola ${store.name}, vi su catálogo y quiero hacer una consulta.`)}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[#1fa855] px-3 text-sm font-bold text-white"
        >
          <WhatsAppIcon className="size-4" /> <span className="hidden sm:inline">WhatsApp</span>
        </a>
        <CartLink href={`${base}/carrito`} />
      </div>
    </header>
  );
}
