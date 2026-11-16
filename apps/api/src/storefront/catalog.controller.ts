import { Body, Controller, Delete, Get, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppError } from '../common/app-error.js';
import type { TenantContext } from '../common/request-context.js';
import { MAX_UPLOAD_BYTES } from '../images/image-processing.js';
import { CurrentTenant, TenantRoles, TenantScoped } from '../tenancy/decorators.js';
import { CatalogProductsService } from './catalog-products.service.js';
import { CatalogSettingsService } from './catalog-settings.service.js';
import { ListRequestsQueryDto, UpdateRequestDto } from './dto/requests.dto.js';
import { BulkPublishDto, CatalogProductsQueryDto, MediaKindParamDto, PublishProductDto, UpdateCatalogSettingsDto } from './dto/settings.dto.js';
import { OrderRequestsService } from './order-requests.service.js';

const imageUpload = FileInterceptor('file', {
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 2 },
  fileFilter: (_req, file, cb) =>
    /^image\/(jpeg|png|webp)$/.test(file.mimetype)
      ? cb(null, true)
      : cb(new AppError(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'INVALID_IMAGE', 'Usa imágenes JPG, PNG o WebP.'), false),
});

@ApiTags('catalog')
@TenantScoped()
@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly settings: CatalogSettingsService,
    private readonly products: CatalogProductsService,
    private readonly requests: OrderRequestsService,
  ) {}

  @Get('settings')
  @ApiOperation({ summary: 'Configuración del catálogo online (se crea con valores por defecto)' })
  getSettings(@CurrentTenant() t: TenantContext) {
    return this.settings.get(t.tenantId);
  }

  @Patch('settings')
  @TenantRoles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Actualizar nombre visible (la dirección pública sigue al nombre), colores, WhatsApp, mensaje, agotados y estado' })
  updateSettings(@CurrentTenant() t: TenantContext, @Body() dto: UpdateCatalogSettingsDto) {
    return this.settings.update(t.tenantId, dto);
  }

  @Post('media/:kind')
  @TenantRoles('OWNER', 'ADMIN')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(imageUpload)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Subir logotipo o portada (se optimiza a WebP)' })
  upload(@CurrentTenant() t: TenantContext, @Param() p: MediaKindParamDto, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw new AppError(HttpStatus.BAD_REQUEST, 'INVALID_IMAGE', 'Selecciona una imagen.');
    return this.settings.uploadMedia(t.tenantId, p.kind, file.buffer);
  }

  @Delete('media/:kind')
  @TenantRoles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Quitar logotipo o portada' })
  removeMedia(@CurrentTenant() t: TenantContext, @Param() p: MediaKindParamDto) {
    return this.settings.removeMedia(t.tenantId, p.kind);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Productos publicados, ocultos, agotados y solicitudes' })
  summary(@CurrentTenant() t: TenantContext) {
    return this.products.summary(t.tenantId);
  }

  @Get('products')
  @ApiOperation({ summary: 'Productos activos con su estado de publicación' })
  listProducts(@CurrentTenant() t: TenantContext, @Query() q: CatalogProductsQueryDto) {
    return this.products.list(t.tenantId, q);
  }

  @Patch('products/:id')
  @TenantRoles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Mostrar u ocultar un producto en el catálogo (no cambia el inventario)' })
  publish(@CurrentTenant() t: TenantContext, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: PublishProductDto) {
    return this.products.setPublished(t.tenantId, id, dto.catalogPublished);
  }

  @Post('products/bulk-update')
  @TenantRoles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Publicar u ocultar varios productos' })
  bulk(@CurrentTenant() t: TenantContext, @Body() dto: BulkPublishDto) {
    return this.products.bulk(t.tenantId, dto);
  }

  @Get('order-requests')
  @ApiOperation({ summary: 'Solicitudes enviadas desde el catálogo' })
  listRequests(@CurrentTenant() t: TenantContext, @Query() q: ListRequestsQueryDto) {
    return this.requests.list(t.tenantId, q);
  }

  @Get('order-requests/:id')
  @ApiOperation({ summary: 'Detalle de una solicitud' })
  getRequest(@CurrentTenant() t: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.requests.get(t.tenantId, id);
  }

  @Patch('order-requests/:id')
  @ApiOperation({ summary: 'Marcar una solicitud como atendida o cancelada (no crea ventas)' })
  updateRequest(@CurrentTenant() t: TenantContext, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateRequestDto) {
    return this.requests.update(t.tenantId, id, dto);
  }
}
