import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { SESSION_COOKIE } from './auth/session.service.js';
import { listen, setupSwagger } from './common/swagger.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  app.enableShutdownHooks();
  setupSwagger(app, {
    title: 'ModaFlow API',
    description:
      'API de los suscriptores de ModaFlow. Autenticación por cookie HttpOnly `mf_session` (POST /auth/login). ' +
      'Las peticiones de navegador que modifican datos deben venir de un origen permitido (CORS_ORIGINS).',
    cookie: SESSION_COOKIE,
  });
  await listen(app, 'ModaFlow API');
}

await bootstrap();
