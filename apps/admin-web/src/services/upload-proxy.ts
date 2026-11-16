import "server-only";
import type { NextRequest } from "next/server";
import { forwardImageUpload as forward } from "@modaflow/ui/lib/upload-proxy";
import { ADMIN_API_URL, ADMIN_SESSION_COOKIE } from "@/config/session";

export function forwardImageUpload(request: NextRequest, path: string) {
  return forward(request, { apiUrl: ADMIN_API_URL, cookie: ADMIN_SESSION_COOKIE, path });
}

export function forwardBackupUpload(request: NextRequest) {
  return forward(request, {
    apiUrl: ADMIN_API_URL,
    cookie: ADMIN_SESSION_COOKIE,
    path: "/admin/backups/import",
    maxBytes: 500 * 1024 * 1024,
    missingMessage: "No se recibió el archivo de backup.",
    tooLargeMessage: "El backup supera los 500 MB.",
    fileName: "backup.mfbackup",
  });
}
