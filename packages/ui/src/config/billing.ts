import type { PaymentStatus, PeriodKind, PlatformMethod } from "../types/billing";

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = { PENDING: "Pendiente", APPROVED: "Aprobado", REJECTED: "Rechazado", CANCELED: "Cancelado" };

export const PAYMENT_STATUS_TONES: Record<PaymentStatus, string> = {
  PENDING: "bg-amber/15 text-[#7a4f00]",
  APPROVED: "bg-mint/15 text-[#0b7a66]",
  REJECTED: "bg-destructive/10 text-destructive",
  CANCELED: "bg-muted text-ink-2",
};

export const METHOD_LABELS: Record<PlatformMethod, string> = { QR: "QR bancario", TRANSFER: "Transferencia bancaria" };

export const PERIOD_KIND_LABELS: Record<PeriodKind, string> = {
  TRIAL: "Prueba gratuita",
  ACTIVATION: "Activación",
  RENEWAL: "Renovación",
  PLAN_CHANGE: "Cambio de plan",
  EXTENSION: "Extensión de prueba",
};
