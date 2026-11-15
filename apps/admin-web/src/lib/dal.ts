import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { StaffMe } from "@/types/admin";
import { api, ApiError } from "./api";

export const getMe = cache(async (): Promise<StaffMe | null> => {
  try {
    return await api<StaffMe>("/auth/me");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
});

export async function requireStaff(): Promise<StaffMe> {
  const me = await getMe();
  if (!me) redirect("/login");
  return me;
}
