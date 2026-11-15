import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators.js';
import type { BillingPeriod, CatalogAccess, UsagePeriod } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

export class PlanLimitsDto {
  @ApiProperty() products!: number;
  @ApiProperty() aiAnalyses!: number;
  @ApiProperty({ enum: ['TOTAL', 'MONTHLY'] }) aiAnalysesPeriod!: UsagePeriod;
  @ApiProperty() users!: number;
  @ApiProperty() branches!: number;
}

export class PlanFeaturesDto {
  @ApiProperty() inventoryAndSales!: boolean;
  @ApiProperty() advancedReports!: boolean;
  @ApiProperty({ enum: ['NONE', 'TEMPORARY', 'FULL'] }) onlineCatalog!: CatalogAccess;
  @ApiProperty() advancedManagement!: boolean;
}

export class PlanDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'pro' }) code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() tagline!: string;
  @ApiProperty({ description: 'Precio en centavos de boliviano (6900 = Bs 69)' }) priceCents!: number;
  @ApiProperty({ example: 'BOB' }) currency!: string;
  @ApiProperty({ enum: ['TRIAL', 'MONTHLY'] }) billingPeriod!: BillingPeriod;
  @ApiProperty({ nullable: true, type: Number }) durationDays!: number | null;
  @ApiProperty() isTrial!: boolean;
  @ApiProperty() isRecommended!: boolean;
  @ApiProperty({ type: PlanLimitsDto }) limits!: PlanLimitsDto;
  @ApiProperty({ type: PlanFeaturesDto }) features!: PlanFeaturesDto;
  @ApiProperty({ type: [String] }) highlights!: string[];
}

@ApiTags('plans')
@Controller('plans')
export class PlansController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Planes disponibles, con límites y funciones (desde la base de datos)' })
  @ApiOkResponse({ type: [PlanDto] })
  async list(): Promise<PlanDto[]> {
    const plans = await this.prisma.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
    return plans.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      tagline: p.tagline,
      priceCents: p.priceCents,
      currency: p.currency,
      billingPeriod: p.billingPeriod,
      durationDays: p.durationDays,
      isTrial: p.isTrial,
      isRecommended: p.isRecommended,
      limits: {
        products: p.maxProducts,
        aiAnalyses: p.aiAnalysesLimit,
        aiAnalysesPeriod: p.aiAnalysesPeriod,
        users: p.maxUsers,
        branches: p.maxBranches,
      },
      features: {
        inventoryAndSales: p.inventoryAndSales,
        advancedReports: p.advancedReports,
        onlineCatalog: p.onlineCatalog,
        advancedManagement: p.advancedManagement,
      },
      highlights: p.highlights,
    }));
  }
}
