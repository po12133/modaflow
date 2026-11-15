import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { EnvironmentVariables } from '../config/env.validation.js';

export function setupSwagger(app: NestExpressApplication, doc: { title: string; description: string; cookie: string }): void {
  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  if (!config.get('SWAGGER_ENABLED', { infer: true })) return;
  const path = config.get('SWAGGER_PATH', { infer: true });
  const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle(doc.title).setDescription(doc.description).setVersion('0.3.0').addCookieAuth(doc.cookie).build());
  SwaggerModule.setup(path, app, document);
  new Logger('Bootstrap').log(`Swagger UI available at /${path}`);
}

export async function listen(app: NestExpressApplication, name: string): Promise<void> {
  const port = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService).get('PORT', { infer: true });
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`${name} listening on port ${port}`);
}
