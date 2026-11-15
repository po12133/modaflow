import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentAuth } from '../auth/decorators.js';
import { SESSION_COOKIE } from '../auth/session.service.js';
import type { AuthContext } from '../common/request-context.js';
import { StoreDto, StoreFieldsDto } from '../stores/dto.js';
import { OnboardingService } from './onboarding.service.js';

export class OnboardingResultDto {
  @ApiProperty() tenantId!: string;
  @ApiProperty({ type: StoreDto }) store!: StoreDto;
  @ApiProperty({ description: 'false si este usuario o WhatsApp ya usó la prueba gratuita' }) trialGranted!: boolean;
  @ApiPropertyOptional({ nullable: true, type: Date }) trialEndsAt!: Date | null;
}

@ApiTags('onboarding')
@ApiCookieAuth(SESSION_COOKIE)
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Post()
  @ApiOperation({
    summary: 'Configuración inicial: crea empresa, tienda y propietario, y activa la prueba de 14 días (transaccional)',
  })
  @ApiCreatedResponse({ type: OnboardingResultDto })
  @ApiConflictResponse({ description: 'ALREADY_ONBOARDED' })
  createFirstStore(@CurrentAuth() auth: AuthContext, @Body() dto: StoreFieldsDto): Promise<OnboardingResultDto> {
    return this.onboarding.createFirstStore(auth, dto);
  }
}
