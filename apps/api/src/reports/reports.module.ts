import { Module } from '@nestjs/common';
import { ImagesModule } from '../images/images.module.js';
import { DashboardStatsService } from './dashboard-stats.service.js';
import { ExcelExportService } from './export/excel-export.service.js';
import { PdfExportService } from './export/pdf-export.service.js';
import { InventoryStatsService } from './inventory-stats.service.js';
import { ProductStatsService } from './product-stats.service.js';
import { ReportContextService } from './report-context.service.js';
import { DashboardController, ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import { SalesStatsService } from './sales-stats.service.js';
import { SalesTableService } from './sales-table.service.js';

@Module({
  imports: [ImagesModule],
  controllers: [ReportsController, DashboardController],
  providers: [
    ReportContextService,
    SalesStatsService,
    SalesTableService,
    ProductStatsService,
    InventoryStatsService,
    DashboardStatsService,
    ReportsService,
    ExcelExportService,
    PdfExportService,
  ],
})
export class ReportsModule {}
