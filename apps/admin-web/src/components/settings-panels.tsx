import { STORE_TIMEZONES } from "@modaflow/ui/config/timezones";
import type { PlatformSettingsView } from "@/types/admin";
import { dialogField } from "./action-dialog";
import { QrUpload, SettingsForm } from "./settings-form";

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="grid gap-1 text-sm font-semibold">{label}{children}</label>;
const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} className={dialogField} />;
const Area = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...props} className={`${dialogField} h-auto py-2`} />;
const Check = ({ name, label, value }: { name: string; label: string; value: boolean }) => (
  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name={name} defaultChecked={value} className="size-5 accent-[#6c4cf5]" />{label}</label>
);

export function SettingsPanel({ tab, s, canEdit }: { tab: string; s: PlatformSettingsView; canEdit: boolean }) {
  if (tab === "suscripciones") {
    return (
      <SettingsForm section="subscriptions" disabled={!canEdit}>
        <Field label="Días de prueba gratuita (nuevos negocios)"><Input name="trialDays" type="number" min={1} max={90} defaultValue={s.trialDays} /></Field>
        <Field label="Días de aviso antes del vencimiento"><Input name="renewalNoticeDays" type="number" min={0} max={30} defaultValue={s.renewalNoticeDays} /></Field>
        <Field label="Días de conservación de datos tras vencer"><Input name="dataRetentionDays" type="number" min={0} max={3650} defaultValue={s.dataRetentionDays} /></Field>
        <Field label="Política de renovación (visible para el equipo)"><Area name="renewalPolicy" maxLength={1000} defaultValue={s.renewalPolicy ?? "Renovación de plan activo: desde el vencimiento vigente. Plan vencido o en prueba: desde la fecha de aprobación. Cambio de plan: inmediato, sin prorrateo."} /></Field>
      </SettingsForm>
    );
  }
  if (tab === "pagos") {
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <SettingsForm section="payments" disabled={!canEdit}>
          <Check name="qrEnabled" label="Aceptar QR bancario" value={s.qrEnabled} />
          <Check name="transferEnabled" label="Aceptar transferencia bancaria" value={s.transferEnabled} />
          <Field label="Titular"><Input name="accountHolder" maxLength={120} defaultValue={s.accountHolder ?? ""} /></Field>
          <Field label="Banco"><Input name="bankName" maxLength={80} defaultValue={s.bankName ?? ""} /></Field>
          <Field label="Número de cuenta"><Input name="accountNumber" maxLength={40} defaultValue={s.accountNumber ?? ""} /></Field>
          <Field label="Tipo de cuenta"><Input name="accountType" maxLength={40} defaultValue={s.accountType ?? ""} /></Field>
          <Field label="Instrucciones de pago"><Area name="paymentInstructions" maxLength={1000} defaultValue={s.paymentInstructions ?? ""} /></Field>
        </SettingsForm>
        <QrUpload url={s.qrImageUrl} disabled={!canEdit} />
      </div>
    );
  }
  if (tab === "notificaciones") {
    return (
      <SettingsForm section="notifications" disabled={!canEdit}>
        <Field label="Correos que reciben avisos de pagos (separados por coma)"><Area name="notificationEmails" defaultValue={s.notificationEmails.join(", ")} /></Field>
        <p className="text-xs text-muted-foreground">Las notificaciones dentro de la plataforma funcionan siempre. El envío por correo queda pendiente hasta configurar SMTP en el servidor.</p>
      </SettingsForm>
    );
  }
  return (
    <SettingsForm section="general" disabled={!canEdit}>
      <Field label="Nombre de la plataforma"><Input name="platformName" maxLength={60} required defaultValue={s.platformName} /></Field>
      <Field label="Correo de contacto"><Input name="contactEmail" type="email" defaultValue={s.contactEmail ?? ""} /></Field>
      <Field label="WhatsApp de soporte"><Input name="supportWhatsapp" inputMode="tel" defaultValue={s.supportWhatsapp ?? ""} /></Field>
      <Field label="Moneda"><Input value={s.currency} disabled readOnly /></Field>
      <Field label="Zona horaria">
        <select name="timezone" defaultValue={s.timezone} className={dialogField}>
          {STORE_TIMEZONES.map(([tz, label]) => <option key={tz} value={tz}>{label}</option>)}
        </select>
      </Field>
      <p className="text-xs text-muted-foreground">Almacenamiento (S3), IA (Claude) y correo (SMTP) se configuran en sus pestañas, con las llaves cifradas. La contraseña de la base de datos y la clave de cifrado solo se cambian en el servidor.</p>
    </SettingsForm>
  );
}
