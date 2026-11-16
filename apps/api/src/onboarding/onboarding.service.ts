import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { SessionService } from '../auth/session.service.js';
import { AppError } from '../common/app-error.js';
import type { AuthContext } from '../common/request-context.js';
import { Prisma } from '../generated/prisma/client.js';
import { TRIAL_PLAN_CODE } from '../plans/plan-catalog.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { STORE_SELECT } from '../stores/stores.service.js';
import type { StoreFieldsDto } from '../stores/dto.js';
import { freeStoreSlug, newPublicCode } from '../stores/store-address.js';
import { addDays } from '../subscriptions/entitlement-rules.js';
import { latestVersion } from '../billing/plan-versions.js';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  /**
   * Creates tenant + first store + OWNER membership + subscription in a single
   * transaction. The 14-day trial is granted only once per user and per
   * business WhatsApp (TrialGrant), so recreating a store cannot restart it.
   */
  async createFirstStore(auth: AuthContext, dto: StoreFieldsDto) {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Serialize onboarding per user (double submit => second call sees the membership).
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${auth.userId}::uuid FOR UPDATE`;

        const existing = await tx.tenantMembership.count({ where: { userId: auth.userId } });
        if (existing > 0) {
          throw new AppError(HttpStatus.CONFLICT, 'ALREADY_ONBOARDED', 'Tu tienda ya está creada.');
        }

        const trialPlan = await tx.plan.findUnique({ where: { code: TRIAL_PLAN_CODE } });
        if (!trialPlan?.durationDays) {
          throw new Error(`Plan "${TRIAL_PLAN_CODE}" missing: run the Prisma seed.`);
        }

        const previousGrant = await tx.trialGrant.findFirst({
          where: { OR: [{ userId: auth.userId }, { whatsappNormalized: dto.whatsapp }] },
          select: { id: true },
        });
        const trialGranted = !previousGrant;

        const tenant = await tx.tenant.create({ data: { name: dto.name } });
        await tx.tenantMembership.create({ data: { tenantId: tenant.id, userId: auth.userId, role: 'OWNER' } });

        const store = await tx.store.create({
          data: {
            tenantId: tenant.id,
            slug: await freeStoreSlug(tx, dto.name),
            publicCode: newPublicCode(),
            name: dto.name,
            description: dto.description ?? null,
            whatsapp: dto.whatsapp,
            city: dto.city,
            address: dto.address ?? null,
            primaryColor: dto.primaryColor,
          },
          select: STORE_SELECT,
        });

        const now = new Date();
        const settings = await tx.platformSettings.findUnique({ where: { id: 1 }, select: { trialDays: true } });
        const trialEndsAt = addDays(now, settings?.trialDays ?? trialPlan.durationDays);
        const version = await latestVersion(tx, trialPlan.id);
        const subscription = await tx.subscription.create({
          data: {
            tenantId: tenant.id,
            planId: trialPlan.id,
            planVersionId: version.id,
            // Without trial eligibility the store is created read-only until a plan is requested.
            status: trialGranted ? 'TRIALING' : 'EXPIRED',
            startedAt: now,
            currentPeriodEnd: trialGranted ? trialEndsAt : now,
          },
        });
        if (trialGranted) {
          await tx.trialGrant.create({
            data: { userId: auth.userId, tenantId: tenant.id, whatsappNormalized: dto.whatsapp },
          });
          await tx.subscriptionPeriod.create({
            data: { subscriptionId: subscription.id, tenantId: tenant.id, planId: trialPlan.id, planVersionId: version.id, kind: 'TRIAL', periodStart: now, periodEnd: trialEndsAt, amount: 0 },
          });
          await tx.subscriptionHistory.create({
            data: { subscriptionId: subscription.id, tenantId: tenant.id, action: 'TRIAL_STARTED', toStatus: 'TRIALING', toPlanId: trialPlan.id, toPeriodEnd: trialEndsAt, actorId: auth.userId },
          });
        }

        return { tenantId: tenant.id, store, trialGranted, trialEndsAt: trialGranted ? trialEndsAt : null };
      });

      await this.sessions.setActiveTenant(auth.sessionId, result.tenantId);
      this.logger.log(`Tenant ${result.tenantId} created (trial ${result.trialGranted ? 'granted' : 'not eligible'})`);
      return result;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // Concurrent onboarding with the same WhatsApp or slug: nothing was persisted.
        throw new AppError(HttpStatus.CONFLICT, 'ALREADY_ONBOARDED', 'No se pudo crear la tienda. Intenta de nuevo.');
      }
      throw error;
    }
  }
}
