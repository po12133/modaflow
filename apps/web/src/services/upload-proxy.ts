import "server-only";
import type { NextRequest } from "next/server";
import { forwardImageUpload as forward } from "@modaflow/ui/lib/upload-proxy";

const API_URL = (process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "");

export function forwardImageUpload(request: NextRequest, path: string) {
  return forward(request, { apiUrl: API_URL, cookie: "mf_session", path });
}
