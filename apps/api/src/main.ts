import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { SESSION_COOKIE } from './auth/session.service.js';
import { EnvironmentVariables } from './config/env.validation.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  const logger = new Logger('Bootstrap');

  configureApp(app);
  app.enableShutdownHooks();

  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    const swaggerPath = config.get('SWAGGER_PATH', { infer: true });
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('ModaFlow API')
        .setDescription(
          'API de ModaFlow. Autenticación por cookie HttpOnly `mf_session` (POST /auth/login). ' +
            'Las peticiones de navegador que modifican datos deben venir de un origen permitido (CORS_ORIGINS).',
        )
        .setVersion('0.2.0')
        .addCookieAuth(SESSION_COOKIE)
        .build(),
    );
    SwaggerModule.setup(swaggerPath, app, document);
    logger.log(`Swagger UI available at /${swaggerPath}`);
  }

  const port = config.get('PORT', { infer: true });
  await app.listen(port, '0.0.0.0');
  logger.log(`ModaFlow API listening on port ${port}`);
}

await bootstrap();
