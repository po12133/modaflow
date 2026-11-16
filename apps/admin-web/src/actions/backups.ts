"use server";

import type { ActionResult } from "@modaflow/ui/types/actions";
import { check, mutate, uuid } from "@/lib/actions";

export async function createBackupAction(): Promise<ActionResult<{ id: string }>> {
  return mutate<{ id: string }>("/admin/backups", "POST");
}

export async function downloadBackupAction(id: string): Promise<ActionResult<{ url: string; fileName: string }>> {
  const v = check(uuid, id);
  return v.ok ? mutate<{ url: string; fileName: string }>(`/admin/backups/${id}/download`, "POST") : v;
}

export async function deleteBackupAction(id: string): Promise<ActionResult<null>> {
  const v = check(uuid, id);
  return v.ok ? mutate(`/admin/backups/${id}`, "DELETE") : v;
}
