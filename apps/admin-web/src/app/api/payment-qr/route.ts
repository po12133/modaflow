import type { NextRequest } from "next/server";
import { forwardImageUpload } from "@/services/upload-proxy";

export async function POST(request: NextRequest) {
  const plan = request.nextUrl.searchParams.get("plan");
  if (plan && /^[a-z0-9-]{2,32}$/.test(plan)) return forwardImageUpload(request, `/admin/settings/plan-qrs/${plan}`);
  return forwardImageUpload(request, "/admin/settings/payment-qr");
}
