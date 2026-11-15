import { NextResponse, type NextRequest } from "next/server";
import { forwardImageUpload } from "@/services/upload-proxy";

export async function POST(request: NextRequest, { params }: RouteContext<"/api/catalog/media/[kind]">) {
  const { kind } = await params;
  if (kind !== "logo" && kind !== "cover") return NextResponse.json({ statusCode: 404, code: "NOT_FOUND", message: "Recurso no encontrado." }, { status: 404 });
  return forwardImageUpload(request, `/catalog/media/${kind}`);
}
