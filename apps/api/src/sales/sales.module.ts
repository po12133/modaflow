import { Module } from '@nestjs/common';
import { ImagesModule } from '../images/images.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { ProductsModule } from '../products/products.module.js';
import { DashboardController, PosController, PublicReceiptsController, SalesController } from './sales.controller.js';
import { SalesService } from './sales.service.js';

@Module({
  imports: [InventoryModule, ProductsModule, ImagesModule],
  controllers: [PosController, SalesController, PublicReceiptsController, DashboardController],
  providers: [SalesService],
})
export class SalesModule {}
