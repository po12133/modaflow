import { getPublicStore } from "@/services/storefront";

export async function GET(_request: Request, { params }: RouteContext<"/tienda/[slug]/imagen">) {
  const { slug } = await params;
  const store = await getPublicStore(slug);
  const url = store?.coverUrl ?? store?.logoUrl;
  if (!url) return new Response("Not found", { status: 404 });
  return new Response(null, { status: 302, headers: { location: url, "cache-control": "public, max-age=300" } });
}
