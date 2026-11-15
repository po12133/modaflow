import "server-only";
import type { NextRequest } from "next/server";
import { forwardImageUpload as forward } from "@modaflow/ui/lib/upload-proxy";
import { ADMIN_API_URL, ADMIN_SESSION_COOKIE } from "@/config/session";

export function forwardImageUpload(request: NextRequest, path: string) {
  return forward(request, { apiUrl: ADMIN_API_URL, cookie: ADMIN_SESSION_COOKIE, path });
}
