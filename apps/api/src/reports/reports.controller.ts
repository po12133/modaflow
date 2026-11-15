import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { TenantContext } from '../common/request-context.js';
import { RequireFeature } from '../subscriptions/subscription.guard.js';
import { CurrentTenant, TenantScoped } from '../tenancy/decorators.js';
import { DashboardStatsService } from './dashboard-stats.service.js';
import { ExportQueryDto, InventoryReportQueryDto, PeriodQueryDto, ProductsReportQueryDto, SalesReportQueryDto } from './dto.js';
import { ExcelExportService } from './export/excel-export.service.js';
import { PdfExportService } from './export/pdf-export.service.js';
import { InventoryStatsService } from './inventory-stats.service.js';
import { ProductStatsService } from './product-stats.service.js';
import { ReportContextService } from './report-context.service.js';
import { ReportsService } from './reports.service.js';
import { SalesTableService } from './sales-table.service.js';

export const REPORT_ROLES = ['OWNER', 'ADMIN'] as const;

@ApiTags('reports')
@TenantScoped(...REPORT_ROLES)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly context: ReportContextService,
    private readonly salesTable: SalesTableService,
    private readonly products: ProductStatsService,
    private readonly inventory: InventoryStatsService,
    private readonly excel: ExcelExportService,
    private readonly pdf: PdfExportService,
  ) {}

  @Get('summary')
  @ApiOperation({ summary: 'Indicadores del periodo; con reportes avanzados incluye ganancia estimada y comparación' })
  summary(@CurrentTenant() t: TenantContext, @Query() q: PeriodQueryDto) {
    return this.reports.summary(t.tenantId, q);
  }

  @Get('sales')
  @ApiOperation({ summary: 'Reporte de ventas: tabla paginada con filtros e indicadores con los mismos filtros' })
  sales(@CurrentTenant() t: TenantContext, @Query() q: SalesReportQueryDto) {
    return this.salesTable.report(t.tenantId, q);
  }

  @Get('inventory')
  @ApiOperation({ summary: 'Stock, agotados y stock bajo; con reportes avanzados, valor del inventario y movimientos del periodo' })
  inventoryReport(@CurrentTenant() t: TenantContext, @Query() q: InventoryReportQueryDto) {
    return this.inventory.report(t.tenantId, q);
  }

  @Get('products')
  @RequireFeature('advancedReports')
  @ApiOperation({ summary: 'Productos vendidos (ranking por unidades o ingresos, variantes y categorías)' })
  productsReport(@CurrentTenant() t: TenantContext, @Query() q: ProductsReportQueryDto) {
    return this.products.report(t.tenantId, q);
  }

  @Get('sales-chart')
  @RequireFeature('advancedReports')
  @ApiOperation({ summary: 'Evolución de ventas agrupada por hora, día, semana o mes, con la serie del periodo anterior' })
  salesChart(@CurrentTenant() t: TenantContext, @Query() q: PeriodQueryDto) {
    return this.reports.chart(t.tenantId, q);
  }

  @Get('categories')
  @RequireFeature('advancedReports')
  @ApiOperation({ summary: 'Ingresos y prendas por categoría (categoría al momento de la venta)' })
  categories(@CurrentTenant() t: TenantContext, @Query() q: PeriodQueryDto) {
    return this.reports.categories(t.tenantId, q);
  }

  @Get('payment-methods')
  @RequireFeature('advancedReports')
  @ApiOperation({ summary: 'Ventas y total por método de pago' })
  paymentMethods(@CurrentTenant() t: TenantContext, @Query() q: PeriodQueryDto) {
    return this.reports.paymentMethods(t.tenantId, q);
  }

  @Get('export/excel')
  @RequireFeature('advancedReports')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @ApiOkResponse({ description: 'Archivo .xlsx (resumen, ventas, productos o inventario)' })
  @ApiOperation({ summary: 'Exportar a Excel con los mismos filtros que la consulta' })
  async exportExcel(@CurrentTenant() t: TenantContext, @Query() q: ExportQueryDto, @Res() res: Response) {
    const { ctx, period } = await this.context.resolve(t.tenantId, q);
    await this.excel.write(ctx, period, q, res);
  }

  @Get('export/pdf')
  @RequireFeature('advancedReports')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiProduces('application/pdf')
  @ApiOkResponse({ description: 'Archivo PDF A4 paginado' })
  @ApiOperation({ summary: 'Exportar a PDF con los mismos filtros que la consulta' })
  async exportPdf(@CurrentTenant() t: TenantContext, @Query() q: ExportQueryDto, @Res() res: Response) {
    const { ctx, period } = await this.context.resolve(t.tenantId, q);
    await this.pdf.write(ctx, period, q, res);
  }
}

@ApiTags('dashboard')
@TenantScoped()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardStatsService) {}

  @Get('sales-summary')
  @ApiOperation({ summary: 'Inicio del panel: ventas de hoy y del mes (sin anuladas), últimas ventas y stock bajo' })
  summary(@CurrentTenant() t: TenantContext) {
    return this.dashboard.summary(t.tenantId);
  }
}
