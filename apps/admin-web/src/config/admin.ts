import { BarChart3, DatabaseBackup, Gauge, Bell, Building2, ClipboardList, CreditCard, LayoutDashboard, Layers, Receipt, Settings, UserCog, Users, type LucideIcon } from "lucide-react";

export const ADMIN_NAV: [string, string, LucideIcon][] = [
  ["/", "Dashboard", LayoutDashboard],
  ["/negocios", "Negocios", Building2],
  ["/usuarios", "Usuarios", Users],
  ["/planes", "Planes", Layers],
  ["/suscripciones", "Suscripciones", CreditCard],
  ["/pagos", "Pagos", Receipt],
  ["/estadisticas", "Estadísticas", BarChart3],
  ["/consumo", "Consumo", Gauge],
  ["/notificaciones", "Notificaciones", Bell],
  ["/auditoria", "Auditoría", ClipboardList],
  ["/equipo", "Equipo", UserCog],
  ["/backups", "Backups", DatabaseBackup],
  ["/configuracion", "Configuración", Settings],
];

export const ADMIN_PERIODS: [string, string][] = [
  ["today", "Hoy"],
  ["last7", "Últimos 7 días"],
  ["this_month", "Este mes"],
  ["last_month", "Mes anterior"],
  ["this_year", "Este año"],
  ["custom", "Personalizado"],
];

export const SUBSCRIPTION_STATUS_TONES: Record<string, string> = {
  TRIALING: "bg-[#e7efff] text-[#2357b8]",
  ACTIVE: "bg-mint/15 text-[#0b7a66]",
  EXPIRED: "bg-amber/15 text-[#7a4f00]",
  SUSPENDED: "bg-destructive/10 text-destructive",
  CANCELED: "bg-muted text-ink-2",
};

export const HISTORY_LABELS: Record<string, string> = {
  TRIAL_STARTED: "Inicio de prueba",
  TRIAL_EXTENDED: "Prueba extendida",
  ACTIVATED: "Activación",
  RENEWED: "Renovación",
  PLAN_CHANGED: "Cambio de plan",
  SUSPENDED: "Suspensión",
  REACTIVATED: "Reactivación",
  CANCELED: "Cancelación",
  EXPIRED: "Vencimiento",
};
