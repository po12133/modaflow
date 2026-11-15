import type { PublicStore } from "@/types/catalog";

export function StoreHero({ store }: { store: PublicStore }) {
  return (
    <section aria-label={`Portada de ${store.name}`} className="relative overflow-hidden rounded-3xl bg-[linear-gradient(120deg,var(--brand),var(--brand-2))] text-[var(--brand-ink)]">
      {store.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- signed S3 URL
        <img src={store.coverUrl} alt="" fetchPriority="high" className="absolute inset-0 size-full object-cover" />
      )}
      <div className={`relative grid min-h-36 content-end gap-1 p-5 sm:min-h-56 sm:p-8 ${store.coverUrl ? "bg-gradient-to-t from-black/65 via-black/20 to-transparent text-white" : ""}`}>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-4xl">{store.name}</h1>
        {store.description && <p className="max-w-xl text-sm sm:text-base">{store.description}</p>}
      </div>
    </section>
  );
}
