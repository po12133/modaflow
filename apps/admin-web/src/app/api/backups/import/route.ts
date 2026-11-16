import type { NextRequest } from "next/server";
import { forwardBackupUpload } from "@/services/upload-proxy";

export async function POST(request: NextRequest) {
  return forwardBackupUpload(request);
}
