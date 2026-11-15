import { NextResponse, type NextRequest } from "next/server";
import { forwardImageUpload } from "@/services/upload-proxy";

export async function POST(request: NextRequest, { params }: RouteContext<"/api/billing/receipt/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ statusCode: 404, code: "NOT_FOUND", message: "Solicitud no válida." }, { status: 404 });
  return forwardImageUpload(request, `/subscription/payment-requests/${id}/receipt`);
}
