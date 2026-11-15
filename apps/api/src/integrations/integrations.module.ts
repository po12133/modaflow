import { Global, Module } from '@nestjs/common';
import { IntegrationConfigService } from './integration-config.service.js';

@Global()
@Module({
  providers: [IntegrationConfigService],
  exports: [IntegrationConfigService],
})
export class IntegrationsModule {}
