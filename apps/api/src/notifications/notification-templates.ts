import type { NotificationType } from '../generated/prisma/enums.js';

export interface TemplateData {
  tenantName?: string;
  planName?: string;
  amount?: string;
  date?: string;
  days?: number;
  reason?: string;
  requestId?: string;
}

interface Rendered {
  title: string;
  body: string;
  link: string | null;
}

const bs = (amount?: string) => (amount ? `Bs ${Number(amount).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '');

export function notificationTemplate(type: NotificationType, audience: 'TENANT' | 'ADMIN', d: TemplateData): Rendered {
  if (audience === 'ADMIN') {
    return {
      title: `Nuevo comprobante de ${d.tenantName ?? 'un negocio'}`,
      body: `${d.tenantName ?? 'Un negocio'} envió un comprobante por ${bs(d.amount)} para el plan ${d.planName ?? ''}. Revísalo en Pagos.`,
      link: d.requestId ? `/admin/pagos/${d.requestId}` : '/admin/pagos',
    };
  }
  const subscription = '/dashboard/suscripcion';
  switch (type) {
    case 'TRIAL_ENDING':
      return { title: 'Tu prueba gratuita está por terminar', body: `Tu prueba termina el ${d.date}. Elige un plan para seguir vendiendo sin interrupciones.`, link: subscription };
    case 'TRIAL_EXPIRED':
      return { title: 'Tu prueba gratuita terminó', body: 'Tus datos siguen guardados. Elige un plan para volver a registrar ventas y publicar tu catálogo.', link: subscription };
    case 'PAYMENT_SUBMITTED':
      return { title: 'Recibimos tu comprobante', body: `Revisaremos tu pago de ${bs(d.amount)} para el plan ${d.planName}. Te avisaremos al aprobarlo.`, link: subscription };
    case 'PAYMENT_APPROVED':
      return { title: 'Pago aprobado', body: `Aprobamos tu pago de ${bs(d.amount)}. Tu plan ${d.planName} está activo hasta el ${d.date}.`, link: subscription };
    case 'PAYMENT_REJECTED':
      return { title: 'Pago no aprobado', body: `No pudimos aprobar tu pago para el plan ${d.planName}. Motivo: ${d.reason}`, link: subscription };
    case 'SUBSCRIPTION_ACTIVATED':
      return { title: 'Suscripción activada', body: `Tu plan ${d.planName} está activo hasta el ${d.date}.`, link: subscription };
    case 'SUBSCRIPTION_ENDING':
      return { title: 'Tu suscripción vence pronto', body: `Tu plan ${d.planName} vence el ${d.date}. Renueva para no perder el acceso.`, link: subscription };
    case 'SUBSCRIPTION_EXPIRED':
      return { title: 'Tu suscripción venció', body: `Tu plan ${d.planName} venció. Tus datos siguen guardados; renueva para volver a operar.`, link: subscription };
  }
}
