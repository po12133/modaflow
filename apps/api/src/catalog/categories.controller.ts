import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';
import type { TenantContext } from '../common/request-context.js';
import { Trim } from '../common/validation.js';
import { RequireActiveSubscription } from '../subscriptions/subscription.guard.js';
import { CurrentTenant, TenantRoles, TenantScoped } from '../tenancy/decorators.js';
import { CategoriesService } from './categories.service.js';

class CategoryNameDto {
  @ApiProperty({ example: 'Blusas' })
  @Trim()
  @IsString()
  @Length(2, 60, { message: 'El nombre de la categoría debe tener entre 2 y 60 caracteres.' })
  name!: string;
}

class TagQueryDto {
  @ApiPropertyOptional({ example: 'manga' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  search?: string;
}

export class CategoryDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() sortOrder!: number;
  @ApiProperty({ description: 'Productos activos en la categoría' }) productCount!: number;
}

class TagDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
}

@ApiTags('categories')
@TenantScoped()
@Controller()
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get('categories')
  @ApiOperation({ summary: 'Categorías de la tienda (se crean las iniciales la primera vez)' })
  @ApiOkResponse({ type: [CategoryDto] })
  list(@CurrentTenant() tenant: TenantContext) {
    return this.categories.list(tenant.tenantId);
  }

  @Post('categories')
  @RequireActiveSubscription()
  @ApiOperation({ summary: 'Crear categoría (sin duplicados por mayúsculas, tildes o espacios)' })
  @ApiCreatedResponse({ type: CategoryDto })
  @ApiConflictResponse({ description: 'CATEGORY_EXISTS' })
  create(@CurrentTenant() tenant: TenantContext, @Body() dto: CategoryNameDto) {
    return this.categories.create(tenant.tenantId, dto.name);
  }

  @Patch('categories/:id')
  @TenantRoles('OWNER', 'ADMIN')
  @RequireActiveSubscription()
  @ApiOperation({ summary: 'Renombrar categoría (propietario o administrador)' })
  @ApiOkResponse({ type: CategoryDto })
  rename(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CategoryNameDto,
  ) {
    return this.categories.rename(tenant.tenantId, id, dto.name);
  }

  @Get('tags')
  @ApiOperation({ summary: 'Etiquetas de la tienda (autocompletado)' })
  @ApiOkResponse({ type: [TagDto] })
  tags(@CurrentTenant() tenant: TenantContext, @Query() query: TagQueryDto) {
    return this.categories.searchTags(tenant.tenantId, query.search);
  }
}
