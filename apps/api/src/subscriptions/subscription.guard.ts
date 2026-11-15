import {
  applyDecorators,
  type CanActivate,
  type ExecutionContext,
  Injectable,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiForbiddenResponse } from '@nestjs/swagger';
import type { AppRequest } from '../common/request-context.js';
import type { FeatureKey } from './entitlement-rules.js';
import { EntitlementsService } from './entitlements.service.js';

const REQUIREMENT_KEY = 'subscription:requirement';

type Requirement = { kind: 'operational' } | { kind: 'feature'; feature: FeatureKey };

/**
 * Enforces subscription rules on a route. Must run after TenantGuard, so use
 * it together with @TenantScoped() (method-level guards run after
 * controller-level ones).
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: EntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<Requirement | undefined>(REQUIREMENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requirement) return true;

    const req = context.switchToHttp().getRequest<AppRequest>();
    if (!req.tenant) throw new Error('SubscriptionGuard requires TenantGuard to run first');

    if (requirement.kind === 'feature') {
      await this.entitlements.assertFeature(req.tenant.tenantId, requirement.feature);
    } else {
      await this.entitlements.assertOperational(req.tenant.tenantId);
    }
    return true;
  }
}

/** Blocks new business operations when the trial/subscription has expired. */
export const RequireActiveSubscription = () =>
  applyDecorators(
    SetMetadata(REQUIREMENT_KEY, { kind: 'operational' } satisfies Requirement),
    UseGuards(SubscriptionGuard),
    ApiForbiddenResponse({ description: 'Suscripción vencida (SUBSCRIPTION_INACTIVE)' }),
  );

/** Requires an active subscription whose plan includes `feature`. */
export const RequireFeature = (feature: FeatureKey) =>
  applyDecorators(
    SetMetadata(REQUIREMENT_KEY, { kind: 'feature', feature } satisfies Requirement),
    UseGuards(SubscriptionGuard),
    ApiForbiddenResponse({ description: 'Función no incluida en el plan (FEATURE_NOT_IN_PLAN)' }),
  );
