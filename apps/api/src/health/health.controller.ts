import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { HealthResponseDto } from './health.dto.js';
import { HealthService } from './health.service.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'API and database health status' })
  @ApiOkResponse({ type: HealthResponseDto, description: 'API and database are up' })
  @ApiServiceUnavailableResponse({ type: HealthResponseDto, description: 'Database is unreachable' })
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthResponseDto> {
    const result = await this.health.check();
    res.status(result.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return result;
  }
}
