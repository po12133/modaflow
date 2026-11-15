import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { TrimToNull } from '../../common/validation.js';
import { STORE_TIMEZONES } from '../../stores/dto.js';
import { NormalizeWhatsapp, WHATSAPP_E164, WHATSAPP_MESSAGE } from '../../stores/store-fields.js';

export class UpdatePlatformSettingsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 60) platformName?: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @TrimToNull() @IsEmail() @MaxLength(254) contactEmail?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @NormalizeWhatsapp() @Matches(WHATSAPP_E164, { message: WHATSAPP_MESSAGE }) supportWhatsapp?: string | null;
  @ApiPropertyOptional({ enum: ['BOB'] }) @IsOptional() @IsIn(['BOB']) currency?: string;
  @ApiPropertyOptional({ enum: STORE_TIMEZONES }) @IsOptional() @IsIn(STORE_TIMEZONES) timezone?: string;
  @ApiPropertyOptional({ minimum: 1, maximum: 90 }) @IsOptional() @IsInt() @Min(1) @Max(90) trialDays?: number;
  @ApiPropertyOptional({ minimum: 0, maximum: 30 }) @IsOptional() @IsInt() @Min(0) @Max(30) renewalNoticeDays?: number;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @TrimToNull() @IsString() @MaxLength(1000) renewalPolicy?: string | null;
  @ApiPropertyOptional({ minimum: 0, maximum: 3650 }) @IsOptional() @IsInt() @Min(0) @Max(3650) dataRetentionDays?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() qrEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() transferEnabled?: boolean;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @TrimToNull() @IsString() @MaxLength(120) accountHolder?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @TrimToNull() @IsString() @MaxLength(80) bankName?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @TrimToNull() @IsString() @MaxLength(40) accountNumber?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @TrimToNull() @IsString() @MaxLength(40) accountType?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @TrimToNull() @IsString() @MaxLength(1000) paymentInstructions?: string | null;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(10) @IsEmail({}, { each: true }) notificationEmails?: string[];
}
