import type { StaffRole } from "./admin";

export type StaffStatus = "ACTIVE" | "DISABLED";

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  status: StaffStatus;
  hasPassword: boolean;
  activeSessions: number;
  lastLoginAt: string | null;
  lockedUntil: string | null;
  createdAt: string;
}

export interface SetupLink {
  setupUrl: string;
  expiresAt: string;
}
