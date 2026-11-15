import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CartProvider } from "@/components/storefront/cart/cart-provider";
import { StoreFooter } from "@/components/storefront/layout/store-footer";
import { StoreHeader } from "@/components/storefront/layout/store-header";
import { StoreNav } from "@/components/storefront/layout/store-nav";
import { StoreTheme } from "@/components/storefront/layout/store-theme";
import { siteOrigin } from "@/services/site";
import { getPublicStore } from "@/services/storefront";

export const instant = false;

export async function generateMetadata({ params }: LayoutProps<"/tienda/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [store, origin] = await Promise.all([getPublicStore(slug), siteOrigin()]);
  if (!store) return { title: "Catálogo no disponible", robots: { index: false, follow: false } };
  const url = `${origin}/tienda/${store.slug}`;
  const description = store.description ?? `Catálogo de ${store.name} en ${store.city}. Consulta y pide por WhatsApp.`;
  return {
    metadataBase: new URL(origin),
    title: { default: `${store.name} · Catálogo`, template: `%s · ${store.name}` },
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: { type: "website", url, siteName: store.name, title: store.name, description, locale: "es_BO", images: [{ url: `${url}/imagen` }] },
    twitter: { card: "summary_large_image", title: store.name, description, images: [`${url}/imagen`] },
  };
}

export default async function StoreLayout({ children, params }: LayoutProps<"/tienda/[slug]">) {
  const { slug } = await params;
  const store = await getPublicStore(slug);
  if (!store) notFound();
  return (
    <StoreTheme store={store}>
      <CartProvider slug={store.slug}>
        <StoreHeader store={store} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4">{children}</main>
        <StoreFooter store={store} />
        <StoreNav base={`/tienda/${store.slug}`} variant="bottom" />
      </CartProvider>
    </StoreTheme>
  );
}
