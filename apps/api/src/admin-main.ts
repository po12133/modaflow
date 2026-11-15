import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AdminAppModule } from './admin/admin-app.module.js';
import { ADMIN_SESSION_COOKIE } from './admin/auth/staff-session.service.js';
import { configureApp } from './app.setup.js';
import { listen, setupSwagger } from './common/swagger.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AdminAppModule);
  configureApp(app);
  app.enableShutdownHooks();
  setupSwagger(app, {
    title: 'ModaFlow Admin API',
    description:
      'API interna del panel de administración. Solo es accesible desde la red privada (la usa admin-web). ' +
      'Autenticación del equipo por cookie HttpOnly `mf_admin_session` (POST /auth/login).',
    cookie: ADMIN_SESSION_COOKIE,
  });
  await listen(app, 'ModaFlow Admin API');
}

await bootstrap();
