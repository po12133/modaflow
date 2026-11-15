import { HttpStatus, ValidationPipe, type ValidationError } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppError } from './common/app-error.js';
import { EnvironmentVariables } from './config/env.validation.js';

function parseCorsOrigins(value: string): string[] | true {
  const trimmed = value.trim();
  if (trimmed === '*') return true;
  return trimmed
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/** Flattens class-validator errors into { field: [messages] } (nested fields use dot paths). */
function collectErrors(errors: ValidationError[], prefix = '', out: Record<string, string[]> = {}) {
  for (const error of errors) {
    const path = prefix ? `${prefix}.${error.property}` : error.property;
    if (error.constraints) out[path] = Object.values(error.constraints);
    if (error.children?.length) collectErrors(error.children, path, out);
  }
  return out;
}

/** HTTP-level configuration shared by main.ts and the e2e tests. */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  // Real client IP behind Coolify's proxy and the Next.js server (rate limiting, sessions).
  app.set('trust proxy', config.get('TRUST_PROXY', { infer: true }));
  app.use(cookieParser());

  app.enableCors({
    origin: parseCorsOrigins(config.get('CORS_ORIGINS', { infer: true })),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // Unknown fields (e.g. a client-sent tenantId) are rejected, not silently ignored.
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new AppError(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'Revisa los datos ingresados.', {
          errors: collectErrors(errors),
        }),
    }),
  );
}
