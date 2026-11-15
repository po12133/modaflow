import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Matches } from 'class-validator';

export const PLATFORM_METHODS = ['QR', 'TRANSFER'] as const;

export class CreatePaymentRequestDto {
  @ApiProperty({ example: 'pro' }) @IsString() @Matches(/^[a-z0-9_-]{2,32}$/) planCode!: string;
  @ApiProperty({ enum: PLATFORM_METHODS }) @IsIn(PLATFORM_METHODS) method!: (typeof PLATFORM_METHODS)[number];
}
