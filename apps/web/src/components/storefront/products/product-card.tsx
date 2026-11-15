import Link from "next/link";
import { ImageOff } from "lucide-react";
import { formatMoney } from "@/lib/format";
import type { PublicProductCard } from "@/types/catalog";

export function ProductCard({ product, base, priority = false }: { product: PublicProductCard; base: string; priority?: boolean }) {
  return (
    <Link href={`${base}/producto/${product.slug}`} className="group grid overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-[4/5] bg-muted">
        {product.image?.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed S3 URL
          <img
            src={product.image.url}
            alt={product.name}
            width={product.image.width}
            height={product.image.height}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            className={`size-full object-cover transition-transform group-hover:scale-[1.02] ${product.available ? "" : "opacity-60 grayscale"}`}
          />
        ) : (
          <span className="grid size-full place-items-center text-muted-foreground">
            <ImageOff className="size-6" aria-hidden="true" />
          </span>
        )}
        {!product.available && <span className="absolute top-2 left-2 rounded-full bg-foreground px-2 py-0.5 text-xs font-bold text-white">Agotado</span>}
      </div>
      <div className="grid gap-1 p-3">
        {product.category && <span className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">{product.category}</span>}
        <span className="line-clamp-2 text-sm leading-snug font-bold">{product.name}</span>
        <span className="text-base font-extrabold text-[color-mix(in_srgb,var(--brand)_80%,black)]">{formatMoney(product.price)}</span>
        {product.sizes.length > 0 && (
          <span className="flex flex-wrap gap-1" aria-label="Tallas disponibles">
            {product.sizes.slice(0, 5).map((s) => (
              <span key={s} className="rounded-md border px-1.5 text-[0.7rem] font-semibold text-ink-2">
                {s}
              </span>
            ))}
          </span>
        )}
      </div>
    </Link>
  );
}
