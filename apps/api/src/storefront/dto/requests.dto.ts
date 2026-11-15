import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const REQUEST_STATUSES = ['CREATED', 'WHATSAPP_OPENED', 'ATTENDED', 'CANCELED'] as const;

export class ListRequestsQueryDto {
  @ApiPropertyOptional({ enum: REQUEST_STATUSES }) @IsOptional() @IsIn(REQUEST_STATUSES) status?: (typeof REQUEST_STATUSES)[number];
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000) page?: number;
  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize?: number;
}

export class UpdateRequestDto {
  @ApiPropertyOptional({ enum: ['ATTENDED', 'CANCELED'] }) @IsIn(['ATTENDED', 'CANCELED']) status!: 'ATTENDED' | 'CANCELED';
}
