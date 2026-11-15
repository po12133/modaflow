export const ADMIN_SESSION_COOKIE = "mf_admin_session";

export const ADMIN_API_URL = (process.env.ADMIN_API_INTERNAL_URL ?? "http://localhost:3003").replace(/\/$/, "");

export const STAFF_ROLE_LABELS = { SUPERADMIN: "Superadministrador", SUPPORT: "Soporte (solo lectura)" } as const;

export const STAFF_PASSWORD_MIN = 12;
