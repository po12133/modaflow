import { getPublicProduct } from "@/services/storefront";

export async function GET(_request: Request, { params }: RouteContext<"/[slug]/producto/[productSlug]/imagen">) {
  const { slug, productSlug } = await params;
  const product = await getPublicProduct(slug, productSlug);
  const url = product?.images[0]?.url;
  if (!url) return new Response("Not found", { status: 404 });
  return new Response(null, { status: 302, headers: { location: url, "cache-control": "public, max-age=300" } });
}
