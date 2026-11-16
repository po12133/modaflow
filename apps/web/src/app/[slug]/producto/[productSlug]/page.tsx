import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AddToCart } from "@/components/storefront/product/add-to-cart";
import { Gallery } from "@/components/storefront/product/gallery";
import { formatMoney } from "@modaflow/ui/lib/format";
import { siteOrigin } from "@/services/site";
import { getPublicProduct, getPublicStore } from "@/services/storefront";

export const instant = false;

type Props = PageProps<"/[slug]/producto/[productSlug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, productSlug } = await params;
  const [store, product, origin] = await Promise.all([getPublicStore(slug), getPublicProduct(slug, productSlug), siteOrigin()]);
  if (!store || !product) return { title: "Prenda no disponible", robots: { index: false, follow: false } };
  const url = `${origin}/${store.slug}/producto/${product.slug}`;
  const description = `${formatMoney(product.price)} · ${product.available ? "Disponible" : "Agotado"}${product.description ? ` · ${product.description}` : ""}`.slice(0, 200);
  return {
    title: product.name,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, title: `${product.name} · ${store.name}`, description, images: [{ url: `${url}/imagen` }] },
    twitter: { card: "summary_large_image", title: product.name, description, images: [`${url}/imagen`] },
    other: { "product:price:amount": product.price, "product:price:currency": "BOB", "product:availability": product.available ? "in stock" : "out of stock" },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug, productSlug } = await params;
  const [store, product, origin] = await Promise.all([getPublicStore(slug), getPublicProduct(slug, productSlug), siteOrigin()]);
  if (!store || !product) notFound();
  const base = `/${store.slug}`;

  return (
    <article className="grid gap-5 lg:grid-cols-2 lg:gap-8">
      <Link href={base} className="inline-flex items-center gap-1 justify-self-start text-sm font-semibold lg:col-span-2">
        <ChevronLeft className="size-4" aria-hidden="true" /> Catálogo
      </Link>
      <Gallery images={product.images} name={product.name} />
      <div className="grid content-start gap-4">
        <header className="grid gap-1">
          {product.category && <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{product.category}</p>}
          <h1 className="text-2xl font-extrabold tracking-tight">{product.name}</h1>
          <p className="text-2xl font-extrabold text-[color-mix(in_srgb,var(--brand)_80%,black)]">{formatMoney(product.price)}</p>
          <p className={product.available ? "text-sm font-semibold text-[#0b7a66]" : "text-sm font-semibold text-destructive"}>{product.available ? "Disponible" : "Agotado"}</p>
        </header>
        {product.color && <p className="text-sm"><b>Color:</b> {product.color}</p>}
        {product.description && <p className="text-sm leading-relaxed whitespace-pre-line text-ink-2">{product.description}</p>}
        <AddToCart product={product} storeName={store.name} whatsapp={store.whatsapp} productUrl={`${origin}${base}/producto/${product.slug}`} cartHref={`${base}/carrito`} />
      </div>
    </article>
  );
}
