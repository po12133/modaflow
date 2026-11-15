import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators.js';
import { CreateOrderRequestDto, OpenedDto, ProductSlugParamDto, PublicProductsQueryDto, RequestCodeParamDto, StoreSlugParamDto } from './dto/public.dto.js';
import { PublicOrdersService } from './public-orders.service.js';
import { PublicProductsService } from './public-products.service.js';
import { PublicStoreService } from './public-store.service.js';

@ApiTags('public catalog')
@Public()
@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('public')
export class PublicCatalogController {
  constructor(
    private readonly stores: PublicStoreService,
    private readonly products: PublicProductsService,
    private readonly orders: PublicOrdersService,
  ) {}

  @Get('sitemap')
  @SkipThrottle()
  @ApiOperation({ summary: 'Catálogos y productos públicos para el sitemap' })
  sitemap() {
    return this.stores.sitemap();
  }

  @Get('stores/:slug')
  @ApiOperation({ summary: 'Información pública de la tienda (404 neutral si el catálogo no está disponible)' })
  store(@Param() p: StoreSlugParamDto) {
    return this.stores.store(p.slug);
  }

  @Get('stores/:slug/categories')
  @ApiOperation({ summary: 'Categorías con productos publicados' })
  categories(@Param() p: StoreSlugParamDto) {
    return this.products.categories(p.slug);
  }

  @Get('stores/:slug/products')
  @ApiOperation({ summary: 'Productos publicados: búsqueda, filtros, orden y paginación' })
  list(@Param() p: StoreSlugParamDto, @Query() q: PublicProductsQueryDto) {
    return this.products.list(p.slug, q);
  }

  @Get('stores/:slug/products/:productSlug')
  @ApiOperation({ summary: 'Detalle público de una prenda' })
  detail(@Param() p: ProductSlugParamDto) {
    return this.products.detail(p.slug, p.productSlug);
  }

  @Post('stores/:slug/order-requests')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Validar el carrito y registrar una solicitud (no descuenta stock ni crea ventas)' })
  createRequest(@Param() p: StoreSlugParamDto, @Body() dto: CreateOrderRequestDto) {
    return this.orders.create(p.slug, dto);
  }

  @Post('stores/:slug/order-requests/:code/whatsapp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Registrar que el comprador abrió WhatsApp (acción iniciada, no confirma la entrega)' })
  opened(@Param() p: RequestCodeParamDto, @Body() dto: OpenedDto) {
    return this.orders.markOpened(p.slug, p.code, dto.token);
  }
}
