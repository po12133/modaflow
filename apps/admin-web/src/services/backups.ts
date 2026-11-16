import "server-only";
import { api } from "@/lib/api";
import type { BackupsView } from "@/types/backups";

export const getBackups = () => api<BackupsView>("/admin/backups");
