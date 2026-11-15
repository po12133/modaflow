import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { NotificationType } from '../generated/prisma/enums.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { notificationTemplate, type TemplateData } from './notification-templates.js';

type Db = Prisma.TransactionClient | PrismaService;

export interface NotifyInput {
  audience: 'TENANT' | 'ADMIN';
  tenantId?: string | null;
  type: NotificationType;
  dedupeKey: string;
  data?: TemplateData;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async notify(input: NotifyInput, db: Db = this.prisma): Promise<boolean> {
    const t = notificationTemplate(input.type, input.audience, input.data ?? {});
    const created = await db.notification.createMany({
      data: [
        {
          audience: input.audience,
          tenantId: input.tenantId ?? null,
          type: input.type,
          title: t.title,
          body: t.body,
          link: t.link,
          dedupeKey: input.dedupeKey,
          emailStatus: this.mail.isConfigured() ? 'PENDING' : 'SKIPPED',
        },
      ],
      skipDuplicates: true,
    });
    return created.count === 1;
  }

  async deliverPendingEmails(): Promise<void> {
    if (!this.mail.isConfigured()) return;
    const pending = await this.prisma.notification.findMany({ where: { emailStatus: 'PENDING' }, take: 50, orderBy: { createdAt: 'asc' } });
    for (const n of pending) {
      try {
        const recipients = await this.recipients(n.audience, n.tenantId);
        const status = await this.mail.sendNotification(recipients, n.title);
        await this.prisma.notification.update({ where: { id: n.id }, data: { emailStatus: status } });
      } catch (error) {
        this.logger.warn(`Notification email failed: ${String(error)}`);
        await this.prisma.notification.update({ where: { id: n.id }, data: { emailStatus: 'FAILED' } });
      }
    }
  }

  private async recipients(audience: 'TENANT' | 'ADMIN', tenantId: string | null): Promise<string[]> {
    if (audience === 'ADMIN') return (await this.prisma.platformSettings.findUnique({ where: { id: 1 } }))?.notificationEmails ?? [];
    if (!tenantId) return [];
    const owners = await this.prisma.tenantMembership.findMany({ where: { tenantId, role: { in: ['OWNER', 'ADMIN'] } }, select: { user: { select: { email: true } } } });
    return owners.map((o) => o.user.email);
  }

  async listForTenant(tenantId: string, page = 1) {
    const where = { audience: 'TENANT' as const, tenantId };
    const [items, total, unread] = await this.prisma.$transaction([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * 20, take: 20 }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { ...where, readAt: null } }),
    ]);
    return { items: items.map(strip), total, unread, page, pageSize: 20, totalPages: Math.max(1, Math.ceil(total / 20)) };
  }

  async listForAdmin(page = 1) {
    const where = { audience: 'ADMIN' as const };
    const [items, total, unread] = await this.prisma.$transaction([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * 30, take: 30 }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { ...where, readAt: null } }),
    ]);
    return { items: items.map(strip), total, unread, page, pageSize: 30, totalPages: Math.max(1, Math.ceil(total / 30)) };
  }

  async markRead(scope: { audience: 'TENANT'; tenantId: string } | { audience: 'ADMIN' }, id: string) {
    const where: Prisma.NotificationWhereInput = { audience: scope.audience, ...(scope.audience === 'TENANT' ? { tenantId: scope.tenantId } : {}), readAt: null };
    if (id === 'all') {
      await this.prisma.notification.updateMany({ where, data: { readAt: new Date() } });
      return;
    }
    const result = await this.prisma.notification.updateMany({ where: { ...where, id }, data: { readAt: new Date() } });
    if (result.count === 0) {
      const exists = await this.prisma.notification.count({ where: { ...where, readAt: undefined, id } });
      if (!exists) throw new AppError(HttpStatus.NOT_FOUND, 'NOTIFICATION_NOT_FOUND', 'No se encontró la notificación.');
    }
  }
}

function strip<T extends { dedupeKey: string; tenantId: string | null }>(n: T) {
  const { dedupeKey: _d, tenantId: _t, ...rest } = n;
  return rest;
}
