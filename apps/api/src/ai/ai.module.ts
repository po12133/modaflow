import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { ImagesModule } from '../images/images.module.js';
import { AiController } from './ai.controller.js';
import { AiService } from './ai.service.js';
import { ClaudeGarmentRecognizer } from './claude-garment-recognizer.js';
import { GarmentRecognizer } from './garment-recognizer.js';

@Module({
  imports: [CatalogModule, ImagesModule],
  controllers: [AiController],
  providers: [AiService, { provide: GarmentRecognizer, useClass: ClaudeGarmentRecognizer }],
})
export class AiModule {}
