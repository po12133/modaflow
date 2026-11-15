export type IntegrationSection = "storage" | "ai" | "email";
export type FieldSource = "panel" | "env" | "none";
type Plain = string | number | boolean | null;

export interface PlainFieldState {
  value: Plain;
  envValue: Plain;
  source: FieldSource;
}

export interface SecretFieldState {
  configured: boolean;
  source: FieldSource;
  hint: string | null;
  unreadable: boolean;
}

export interface SectionState {
  active: boolean;
  fields: Record<string, PlainFieldState>;
  secrets: Record<string, SecretFieldState>;
}

export interface IntegrationsView {
  encryptionReady: boolean;
  updatedAt: string;
  updatedBy: string | null;
  storage: SectionState;
  ai: SectionState;
  email: SectionState;
}

export interface IntegrationTestResult {
  ok: boolean;
  message: string;
}

export type FieldKind = "text" | "number" | "boolean";

export interface FieldDef {
  name: string;
  label: string;
  kind: FieldKind;
  help?: string;
  placeholder?: string;
}

export interface SectionDef {
  title: string;
  description: string;
  fields: FieldDef[];
  secrets: { name: string; label: string; help?: string }[];
}
