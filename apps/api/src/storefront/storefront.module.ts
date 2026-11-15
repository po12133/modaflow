import { Module } from '@nestjs/common';
import { ImagesModule } from '../images/images.module.js';
import { CatalogProductsService } from './catalog-products.service.js';
import { CatalogSettingsService } from './catalog-settings.service.js';
import { CatalogController } from './catalog.controller.js';
import { OrderRequestsService } from './order-requests.service.js';
import { PublicCatalogController } from './public-catalog.controller.js';
import { PublicOrdersService } from './public-orders.service.js';
import { PublicProductsService } from './public-products.service.js';
import { PublicStoreService } from './public-store.service.js';
import { StorefrontAccessService } from './storefront-access.service.js';

@Module({
  imports: [ImagesModule],
  controllers: [CatalogController, PublicCatalogController],
  providers: [
    StorefrontAccessService,
    CatalogSettingsService,
    CatalogProductsService,
    OrderRequestsService,
    PublicStoreService,
    PublicProductsService,
    PublicOrdersService,
  ],
})
export class StorefrontModule {}
