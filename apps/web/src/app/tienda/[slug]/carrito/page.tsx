import type { Metadata } from "next";
import { CartView } from "@/components/storefront/cart/cart-view";

export const metadata: Metadata = { title: "Carrito", robots: { index: false, follow: true } };

export const instant = false;

export default async function CartPage({ params }: PageProps<"/tienda/[slug]/carrito">) {
  const { slug } = await params;
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Tu carrito</h1>
      <CartView base={`/tienda/${slug}`} />
    </div>
  );
}
