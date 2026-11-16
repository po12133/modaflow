import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { WhatsAppIcon } from "@/components/common/whatsapp-icon";
import { StoreLogo } from "@/components/storefront/layout/store-header";
import { whatsappLink } from "@/lib/catalog";
import { getPublicStore } from "@/services/storefront";

export const metadata: Metadata = { title: "Información de la tienda" };

export const instant = false;

export default async function StoreInfoPage({ params }: PageProps<"/[slug]/info">) {
  const { slug } = await params;
  const store = await getPublicStore(slug);
  if (!store) notFound();
  return (
    <section className="grid max-w-xl gap-4 rounded-3xl border bg-white p-5">
      <div className="flex items-center gap-3">
        <StoreLogo store={store} className="size-16" />
        <h1 className="text-2xl font-extrabold tracking-tight">{store.name}</h1>
      </div>
      {store.description && <p className="text-sm leading-relaxed text-ink-2">{store.description}</p>}
      <p className="flex items-start gap-2 text-sm">
        <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        {store.address ? `${store.address}, ${store.city}` : store.city}
      </p>
      <a href={whatsappLink(store.whatsapp, `Hola ${store.name}, quiero hacer una consulta.`)} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#1fa855] font-bold text-white">
        <WhatsAppIcon /> Escribir por WhatsApp
      </a>
      <p className="text-xs text-muted-foreground">Las compras se coordinan directamente con la tienda por WhatsApp. ModaFlow no procesa pagos.</p>
    </section>
  );
}
