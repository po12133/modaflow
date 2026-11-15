import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { EnvironmentVariables } from './config/env.validation.js';

function parseCorsOrigins(value: string): string[] | true {
  const trimmed = value.trim();
  if (trimmed === '*') return true;
  return trimmed
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  const logger = new Logger('Bootstrap');

  app.enableCors({
    origin: parseCorsOrigins(config.get('CORS_ORIGINS', { infer: true })),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();

  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    const swaggerPath = config.get('SWAGGER_PATH', { infer: true });
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('ModaFlow API')
        .setDescription('ModaFlow backend API')
        .setVersion('0.1.0')
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
