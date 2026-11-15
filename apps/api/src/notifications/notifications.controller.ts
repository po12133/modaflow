import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { TenantContext } from '../common/request-context.js';
import { PageQueryDto } from '../admin/dto.js';
import { CurrentTenant, TenantScoped } from '../tenancy/decorators.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('notifications')
@TenantScoped()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Notificaciones del negocio actual' })
  list(@CurrentTenant() t: TenantContext, @Query() q: PageQueryDto) {
    return this.notifications.listForTenant(t.tenantId, q.page ?? 1);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Marcar todas como leídas' })
  async readAll(@CurrentTenant() t: TenantContext) {
    await this.notifications.markRead({ audience: 'TENANT', tenantId: t.tenantId }, 'all');
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Marcar una notificación como leída' })
  async read(@CurrentTenant() t: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.notifications.markRead({ audience: 'TENANT', tenantId: t.tenantId }, id);
  }
}
