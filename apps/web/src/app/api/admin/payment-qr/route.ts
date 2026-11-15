import type { NextRequest } from "next/server";
import { forwardImageUpload } from "@/services/upload-proxy";

export async function POST(request: NextRequest) {
  return forwardImageUpload(request, "/admin/settings/payment-qr");
}
