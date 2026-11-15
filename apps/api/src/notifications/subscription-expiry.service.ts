import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from './notifications.service.js';

const LOCK_KEY = 6_042_001;
const DAY_MS = 86_400_000;
const dateText = (d: Date) => new Intl.DateTimeFormat('es-BO', { dateStyle: 'long', timeZone: 'America/La_Paz' }).format(d);

interface DueRow {
  id: string;
  tenant_id: string;
  status: 'TRIALING' | 'ACTIVE';
  current_period_end: Date;
  plan_name: string;
  is_trial: boolean;
}

@Injectable()
export class SubscriptionExpiryService {
  private readonly logger = new Logger(SubscriptionExpiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Interval('subscription-expiry', 10 * 60_000)
  async tick(): Promise<void> {
    if (process.env['SCHEDULER_ENABLED'] === 'false') return;
    try {
      const result = await this.run(new Date());
      if (result.ran && (result.expired || result.ending)) this.logger.log(`Expired ${result.expired}, notified ${result.ending} upcoming renewals.`);
      await this.notifications.deliverPendingEmails();
    } catch (error) {
      this.logger.error(`Subscription expiry job failed: ${String(error)}`);
    }
  }

  async run(now: Date): Promise<{ ran: boolean; expired: number; ending: number }> {
    return this.prisma.$transaction(async (tx) => {
      const [lock] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(${LOCK_KEY}) AS locked`;
      if (!lock?.locked) return { ran: false, expired: 0, ending: 0 };
      const settings = await tx.platformSettings.findUnique({ where: { id: 1 } });
      const noticeUntil = new Date(now.getTime() + (settings?.renewalNoticeDays ?? 5) * DAY_MS);

      const due = await tx.$queryRaw<DueRow[]>`
        SELECT s.id, s.tenant_id, s.status::text AS status, s.current_period_end, p.name AS plan_name, p.is_trial
        FROM subscriptions s JOIN plans p ON p.id = s.plan_id
        WHERE s.status IN ('TRIALING', 'ACTIVE') AND s.current_period_end <= ${now}
        ORDER BY s.id
        FOR UPDATE OF s SKIP LOCKED`;
      for (const s of due) {
        await tx.subscription.update({ where: { id: s.id }, data: { status: 'EXPIRED' } });
        await tx.subscriptionHistory.create({
          data: { subscriptionId: s.id, tenantId: s.tenant_id, action: 'EXPIRED', fromStatus: s.status, toStatus: 'EXPIRED', fromPeriodEnd: s.current_period_end, toPeriodEnd: s.current_period_end, reason: 'Vencimiento automático' },
        });
        const trial = s.status === 'TRIALING';
        await this.notifications.notify(
          { audience: 'TENANT', tenantId: s.tenant_id, type: trial ? 'TRIAL_EXPIRED' : 'SUBSCRIPTION_EXPIRED', dedupeKey: `tenant:expired:${s.id}:${s.current_period_end.toISOString()}`, data: { planName: s.plan_name } },
          tx,
        );
      }

      const ending = await tx.$queryRaw<DueRow[]>`
        SELECT s.id, s.tenant_id, s.status::text AS status, s.current_period_end, p.name AS plan_name, p.is_trial
        FROM subscriptions s JOIN plans p ON p.id = s.plan_id
        WHERE s.status IN ('TRIALING', 'ACTIVE') AND s.current_period_end > ${now} AND s.current_period_end <= ${noticeUntil}`;
      let notified = 0;
      for (const s of ending) {
        const created = await this.notifications.notify(
          {
            audience: 'TENANT',
            tenantId: s.tenant_id,
            type: s.status === 'TRIALING' ? 'TRIAL_ENDING' : 'SUBSCRIPTION_ENDING',
            dedupeKey: `tenant:ending:${s.id}:${s.current_period_end.toISOString()}`,
            data: { planName: s.plan_name, date: dateText(s.current_period_end) },
          },
          tx,
        );
        if (created) notified++;
      }
      return { ran: true, expired: due.length, ending: notified };
    });
  }
}
