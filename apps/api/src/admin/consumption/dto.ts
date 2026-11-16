import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID, Matches } from 'class-validator';
import { PageQueryDto } from '../../common/page-query.dto.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PERIODS = ['today', 'last7', 'this_month', 'last_month', 'this_year', 'custom'] as const;
const AI_STATUSES = ['SUCCEEDED', 'FAILED', 'PENDING'] as const;

export class ConsumptionQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: PERIODS }) @IsOptional() @IsIn(PERIODS) period?: (typeof PERIODS)[number];
  @ApiPropertyOptional() @IsOptional() @Matches(DATE) from?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(DATE) to?: string;
}

export class AiLogQueryDto extends ConsumptionQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() tenantId?: string;
  @ApiPropertyOptional({ enum: AI_STATUSES }) @IsOptional() @IsIn(AI_STATUSES) status?: (typeof AI_STATUSES)[number];
}
