# ModaFlow

Monorepo (npm workspaces) con la configuración inicial de ModaFlow:

| Servicio   | Tecnología                                            | Carpeta     | Puerto |
|------------|-------------------------------------------------------|-------------|--------|
| `web`      | Next.js 16 (App Router) · React 19 · Tailwind 4 · shadcn/ui | `apps/web`  | 3000   |
| `api`      | NestJS 12 · Prisma 7 · Swagger                        | `apps/api`  | 3001   |
| `postgres` | PostgreSQL 18                                         | —           | 5432   |

```text
modaflow/
├── apps/
│   ├── web/                 # Next.js (output standalone) + Dockerfile
│   └── api/                 # NestJS + Prisma + Dockerfile
├── deploy/
│   ├── development/compose.yaml   # hot reload
│   ├── staging/compose.yaml       # réplica de producción / Coolify
│   └── production/compose.yaml    # imágenes optimizadas / Coolify
├── .env.example
├── package.json             # npm workspaces
└── README.md
```

## Requisitos

- **Docker Desktop** (o Docker Engine) con **Docker Compose v2**.
- Para trabajar fuera de Docker: **Node.js ≥ 22.12** (las imágenes usan Node 24) y **npm ≥ 11.21**.

> **npm 11 es obligatorio.** npm 10 falla al resolver este árbol de workspaces
> (`Cannot read properties of null (reading 'edgesOut')`) y no reconoce la política
> `allowScripts` del `package.json` raíz. Si tienes npm 10: `npm install -g npm@11.21.2`
> o usa `npx npm@11.21.2 install`. Las imágenes Docker ya instalan npm 11.

## Variables de entorno

```bash
cp .env.example .env
```

Edita `.env` y cambia al menos `POSTGRES_PASSWORD` (y el mismo valor dentro de `DATABASE_URL`).
Usa una contraseña segura para URL (letras y números), por ejemplo `openssl rand -hex 32`.
`.env` está en `.gitignore`: **nunca subas secretos al repositorio.**

| Variable | Tipo | Usada por | Descripción |
|---|---|---|---|
| `POSTGRES_USER` | privada | postgres, api | Usuario de PostgreSQL (por defecto `modaflow`) |
| `POSTGRES_PASSWORD` | **secreta** | postgres, api | Contraseña de PostgreSQL. Obligatoria en producción |
| `POSTGRES_DB` | privada | postgres, api | Base de datos (por defecto `modaflow`) |
| `DATABASE_URL` | **secreta** | api (solo fuera de Docker) | Cadena de conexión. En Docker la compone Compose apuntando a `postgres:5432` |
| `PORT` | privada | api | Puerto de la API (3001) |
| `APP_ENV` | privada | api | `development` / `staging` / `production`. Lo fija cada compose; aparece en `/health` |
| `CORS_ORIGINS` | privada | api | Orígenes permitidos separados por comas, o `*` |
| `SWAGGER_ENABLED` | privada | api | Activa Swagger UI (`true` en desarrollo; `false` por defecto en producción) |
| `SWAGGER_PATH` | privada | api | Ruta de Swagger UI (por defecto `docs`) |
| `SESSION_TTL_DAYS` | privada | api | Duración de la sesión en días (por defecto 30) |
| `COOKIE_SECURE` | privada | api | Cookie `Secure`; por defecto `true` si `NODE_ENV=production` |
| `TRUST_PROXY` | privada | api | Proxies de confianza para obtener la IP real (por defecto redes privadas) |
| `WEB_APP_URL` | privada | api | URL pública del frontend, para los enlaces de recuperación de contraseña |
| `API_INTERNAL_URL` | privada | web (servidor) | URL interna de la API para Next.js (`http://api:3001`, la fija cada compose) |
| `NEXT_PUBLIC_API_URL` | **pública** | web | URL pública de la API. Se incrusta en el bundle **al construir** |

Separación público/privado: el contenedor `web` solo recibe `API_INTERNAL_URL` y `NEXT_PUBLIC_API_URL`; nunca recibe
credenciales de PostgreSQL. Cualquier variable `NEXT_PUBLIC_*` es visible en el navegador: no pongas secretos ahí.
La API valida sus variables al arrancar ([env.validation.ts](apps/api/src/config/env.validation.ts)) y se niega a iniciar si son inválidas.

## Arquitectura (Etapa 1: plataforma del suscriptor)

**Autenticación (sesiones en servidor, patrón BFF)**
- El navegador solo habla con Next.js. Las Server Actions llaman a la API por la red interna (`API_INTERNAL_URL`)
  reenviando la cookie de sesión. La cookie `mf_session` es `HttpOnly`, `SameSite=Lax` y `Secure` en producción,
  y vive en el dominio del frontend. No se guarda nada en `localStorage`.
- La API guarda solo el hash SHA-256 del token de sesión (tabla `sessions`), revocable al cerrar sesión.
- Contraseñas con **Argon2id** (`@node-rs/argon2`, parámetros OWASP).
- Protección contra fuerza bruta: bloqueo de la cuenta 15 min tras 5 intentos fallidos y límite por IP
  (`@nestjs/throttler`: 10 intentos/min en login y registro, 5 cada 15 min en recuperación).
- CSRF: las Server Actions de Next verifican el `Origin`, y la API rechaza peticiones de navegador con un `Origin`
  que no esté en `CORS_ORIGINS` (`OriginGuard`).
- Recuperación de contraseña: token de un solo uso (60 min). **Aún no hay SMTP**: en desarrollo el enlace se
  escribe en los logs de `api`; en producción solo se registra que el correo no se envió.

**Multiempresa**
- `Tenant` (negocio) → `Store` (tiendas) y `TenantMembership` (usuario + rol `OWNER`/`ADMIN`/`SELLER`).
- El tenant de cada petición se resuelve **siempre** desde la membresía del usuario autenticado (`TenantGuard`).
  La API rechaza cualquier `tenantId` enviado por el cliente (`forbidNonWhitelisted`) y filtra todas las consultas por tenant.

**Planes, prueba gratuita y límites**
- Los planes (Gratis, Básico, Pro, Premium) viven en la tabla `plans` y se cargan con el seed
  ([plan-catalog.ts](apps/api/src/plans/plan-catalog.ts)). Pro es el recomendado. No existe el plan Empresarial.
- La prueba de 14 días se activa al crear la primera tienda, en la misma transacción que crea el tenant.
  Se concede una sola vez por usuario y por WhatsApp del negocio (`trial_grants`).
- Al vencer, la cuenta queda en solo lectura: los datos se pueden consultar y se puede entrar a la sección de
  suscripción. Los datos se conservan al menos 30 días más (`dataRetentionUntil`, sin borrado automático).
- `EntitlementsService` es el servicio central de límites y funciones. Los futuros módulos lo usan con
  `@RequireActiveSubscription()`, `@RequireFeature('advancedReports')`, `assertWithinLimit()` o `consumeAiAnalysis()`.
- El suscriptor solo puede **solicitar** un cambio de plan (`plan_change_requests`). No hay pagos ni activación
  automática de planes de pago.

**Endpoints** (ver Swagger): `/auth/*`, `/users/me`, `/onboarding`, `/stores/current`, `/plans`, `/subscription`,
`/subscription/change-requests`, `/health`.

**Frontend**: `/`, `/registro`, `/login`, `/recuperar-contrasena`, `/restablecer-contrasena`, `/onboarding`,
`/dashboard` (+ `suscripcion`, `configuracion`, `cuenta`, `mas`; `inventario`, `vender` y `reportes` aparecen como
"En desarrollo"). Mobile first: en el celular hay barra inferior y en escritorio una barra lateral.

## Desarrollo con Docker (recomendado)

Desde la raíz del repositorio:

```bash
# Iniciar (construye las imágenes la primera vez)
docker compose -f deploy/development/compose.yaml --env-file .env up -d --build

# Estado de los servicios
docker compose -f deploy/development/compose.yaml ps

# Detener (conserva los datos de PostgreSQL)
docker compose -f deploy/development/compose.yaml down

# Detener y BORRAR los datos de PostgreSQL
docker compose -f deploy/development/compose.yaml down -v
```

`--env-file .env` es opcional: sin él se usan valores por defecto solo aptos para desarrollo local.
Atajos equivalentes: `npm run docker:dev`, `npm run docker:dev:down`, `npm run docker:dev:logs`.

- **Hot reload**: se montan `apps/web/src`, `apps/web/public`, `apps/api/src`, `apps/api/prisma` y `apps/api/test`.
  Los cambios en esas carpetas se recargan solos. Si cambias dependencias (`package.json`) o archivos de
  configuración (`next.config.ts`, `tsconfig.json`...), reconstruye con `up -d --build`.
- En Docker Desktop (Windows/macOS) los bind mounts no propagan eventos de archivos, por lo que el compose
  de desarrollo activa *polling* (`WATCH_POLL_INTERVAL_MS`, `TSC_WATCHFILE`). Para la mejor experiencia de
  Next.js puedes ejecutar `web` en el host (ver abajo).

### Accesos en desarrollo

| Qué | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:3001 |
| Health check | http://localhost:3001/health |
| Swagger UI | http://localhost:3001/docs (JSON: `/docs-json`) |
| PostgreSQL | `localhost:5432` (solo en `127.0.0.1`), usuario/contraseña de `.env`, base `modaflow` |

Conexión a PostgreSQL:

```bash
# psql dentro del contenedor
docker compose -f deploy/development/compose.yaml exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

# Prisma Studio desde el host (usa DATABASE_URL del .env)
npm run prisma:studio -w @modaflow/api
```

`GET /health` devuelve `200` cuando la API y la base de datos responden, y `503` si PostgreSQL no está disponible:

```json
{ "status": "ok", "service": "modaflow-api", "environment": "development", "timestamp": "…", "uptime": 42, "database": { "status": "up", "latencyMs": 1 } }
```

### Logs

```bash
docker compose -f deploy/development/compose.yaml logs -f            # todos
docker compose -f deploy/development/compose.yaml logs -f api        # solo api
docker compose -f deploy/development/compose.yaml logs -f web        # solo web
docker compose -f deploy/development/compose.yaml logs -f postgres   # solo postgres
docker compose -f deploy/development/compose.yaml logs --tail 100 api
```

## Desarrollo sin Docker (opcional)

```bash
npm install                                   # npm 11
docker compose -f deploy/development/compose.yaml --env-file .env up -d postgres
npm run dev:api                               # http://localhost:3001 (lee ../../.env)
npm run dev:web                               # http://localhost:3000
```

Otros comandos: `npm run build`, `npm run lint`, `npm run prisma:generate`.

## Pruebas

```bash
# Unitarias (reglas de planes, prueba gratuita, límites, guards, login/bloqueo, WhatsApp)
npm test -w @modaflow/api

# E2E contra PostgreSQL real, en una base de datos separada *_test (se niegan a ejecutarse en otra)
docker compose -f deploy/development/compose.yaml exec postgres sh -c 'createdb -U "$POSTGRES_USER" modaflow_test'
cd apps/api
export DATABASE_URL="postgresql://modaflow:<password>@localhost:5432/modaflow_test?schema=public"
npx prisma migrate deploy && npx prisma db seed
npm run test:e2e
```

Las pruebas e2e cubren: registro, login/logout, bloqueo por intentos, CSRF por origen, recuperación de contraseña,
protección de rutas, onboarding transaccional, prueba de 14 días (y que no se reinicia), planes, días restantes,
edición de la tienda, aislamiento entre tenants, solicitudes de cambio de plan y modo de solo lectura al vencer.

Componentes de shadcn/ui: `cd apps/web && npx shadcn@latest add <componente>`.

## Prisma

- Configuración: [apps/api/prisma7.config.ts](apps/api/prisma7.config.ts) (nombre de archivo propio de Prisma 7.10) y
  [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma).
- Modelos: `User`, `Session`, `PasswordResetToken`, `Tenant`, `TenantMembership`, `Store`, `Plan`, `Subscription`,
  `SubscriptionUsage`, `TrialGrant` y `PlanChangeRequest`, con claves foráneas, índices y restricciones `CHECK`.
- Migraciones versionadas en `apps/api/prisma/migrations`. Al arrancar, el contenedor `api` (desarrollo y
  producción) ejecuta `prisma migrate deploy` (solo aplica migraciones pendientes, nunca borra datos) y el seed de planes.
- Nueva migración en desarrollo: `npm run prisma:migrate:dev -w @modaflow/api -- --name <nombre>`.
- Seed manual: `npm run prisma:seed -w @modaflow/api`. Es idempotente: actualiza los planes por `code` y desactiva
  los que ya no estén en el catálogo.
- Prisma 7 usa *driver adapters*: la conexión se hace con `@prisma/adapter-pg` ([prisma.service.ts](apps/api/src/prisma/prisma.service.ts)).
- El cliente se genera en `apps/api/src/generated/prisma` (ignorado por git) con `npm run prisma:generate`;
  `npm run build` y el contenedor de desarrollo lo generan automáticamente.

## Producción y Coolify

[deploy/production/compose.yaml](deploy/production/compose.yaml) construye imágenes multi-stage:

- **web**: Next.js `output: "standalone"`, usuario no root, sin `node_modules` completos (~300 MB).
- **api**: NestJS compilado (`dist/`), solo dependencias de producción (incluye el CLI de Prisma para migraciones).
- **postgres**: volumen persistente `postgres_data`, **sin puertos publicados** (solo red interna `modaflow`).
- Healthchecks en los tres servicios y `restart: unless-stopped`.
- Los contextos de build apuntan a la raíz del repositorio (`../..`), necesario por los npm workspaces.

Validar y probar localmente:

```bash
docker compose -f deploy/production/compose.yaml --env-file .env config --quiet
docker compose -f deploy/production/compose.yaml --env-file .env up -d --build
docker compose -f deploy/production/compose.yaml --env-file .env ps
docker compose -f deploy/production/compose.yaml --env-file .env logs -f api
docker compose -f deploy/production/compose.yaml --env-file .env down
```

(En producción no se publican puertos; para probar, usa `docker compose ... exec api node -e "fetch('http://127.0.0.1:3001/health').then(r=>r.text()).then(console.log)"`.)

### Configuración en Coolify

1. **New Resource → Public/Private Repository (GitHub)** y selecciona el repositorio y la rama.
2. **Build Pack**: `Docker Compose`.
3. Valores exactos:

   | Campo | Valor |
   |---|---|
   | **Base Directory** | `/deploy/production` |
   | **Docker Compose Location** | `/compose.yaml` |

   Con esta combinación, la carpeta del proyecto de Compose y la del archivo coinciden, de modo que los
   contextos `../..` resuelven a la raíz del repositorio en cualquier caso (Coolify clona el repositorio completo).
4. **Domains** (por servicio, en la pestaña de configuración del recurso). El sufijo `:puerto` indica a Coolify
   el puerto interno del contenedor; el dominio público se sirve en 443:

   | Servicio | Dominio |
   |---|---|
   | `web` | `https://modaflow.amicornios.com:3000` |
   | `api` | `https://api.modaflow.amicornios.com:3001` |
   | `postgres` | *(ninguno — no exponer)* |

5. **Environment Variables** en Coolify:

   | Variable | Valor |
   |---|---|
   | `POSTGRES_PASSWORD` | contraseña segura (obligatoria, URL-safe) |
   | `POSTGRES_USER` | `modaflow` (opcional) |
   | `POSTGRES_DB` | `modaflow` (opcional) |
   | `NEXT_PUBLIC_API_URL` | `https://api.modaflow.amicornios.com` (se usa como build arg de `web`) |
   | `CORS_ORIGINS` | `https://modaflow.amicornios.com` |
   | `SWAGGER_ENABLED` | `false` (o `true` si quieres Swagger público) |

   Si cambias `NEXT_PUBLIC_API_URL`, haz **redeploy** (el valor se incrusta al construir).
6. DNS y certificados: se configuran después desde Coolify (registros A de ambos dominios hacia el servidor;
   Coolify emite los certificados al asignar los dominios).

## Staging

[deploy/staging/compose.yaml](deploy/staging/compose.yaml) es una réplica de producción (mismos Dockerfiles,
`NODE_ENV=production`). Solo cambia:

- `APP_ENV=staging` (visible en `GET /health` para saber a qué entorno llamas).
- Dominios de staging por defecto.
- Swagger activado por defecto (`SWAGGER_ENABLED=true`).
- Base de datos propia: al ser otro recurso en Coolify, tiene su propio volumen y nunca comparte datos con producción.

> Si cambias servicios en `production/compose.yaml`, aplica el mismo cambio en `staging/compose.yaml`
> (son archivos independientes a propósito: Coolify analiza el compose y no conviene depender de `extends`/`include`).

Probar en local (puede convivir con el entorno de desarrollo):

```bash
docker compose -f deploy/staging/compose.yaml --env-file .env up -d --build
docker compose -f deploy/staging/compose.yaml --env-file .env ps
docker compose -f deploy/staging/compose.yaml --env-file .env logs -f api
docker compose -f deploy/staging/compose.yaml --env-file .env down
```

### Staging en Coolify

Crea un **segundo recurso** (mismo repositorio, mismo build pack `Docker Compose`), idealmente sobre una rama
`staging` (y producción sobre `main`):

| Campo | Valor |
|---|---|
| **Branch** | `staging` |
| **Base Directory** | `/deploy/staging` |
| **Docker Compose Location** | `/compose.yaml` |
| Dominio `web` | `https://staging.modaflow.amicornios.com:3000` |
| Dominio `api` | `https://api.staging.modaflow.amicornios.com:3001` |
| Dominio `postgres` | *(ninguno)* |

Variables de entorno de staging (distintas de producción, **otra contraseña**):

| Variable | Valor |
|---|---|
| `POSTGRES_PASSWORD` | contraseña propia de staging (obligatoria) |
| `NEXT_PUBLIC_API_URL` | `https://api.staging.modaflow.amicornios.com` |
| `CORS_ORIGINS` | `https://staging.modaflow.amicornios.com` |
| `SWAGGER_ENABLED` | `true` (o `false`) |

## Versiones instaladas

| Paquete | Versión |
|---|---|
| Node.js (imágenes) | 24 (alpine) |
| npm | 11.21.2 |
| Next.js | 16.4.6 |
| React / React DOM | 19.3.0 |
| Tailwind CSS | 4.3.3 |
| shadcn (CLI, estilo `radix-nova`) | 4.23.0 |
| TypeScript | 6.0.3 |
| ESLint | 9.39.5 |
| NestJS (core) | 12.5.0 |
| @nestjs/cli | 12.0.13 |
| @nestjs/swagger | 12.1.2 |
| @nestjs/config | 12.1.1 |
| Prisma / @prisma/client / @prisma/adapter-pg | 7.10.1 |
| pg | 8.23.1 |
| class-validator / class-transformer | 0.15.1 / 0.5.1 |
| Vitest | 4.1.12 |
| PostgreSQL | 18 (alpine) |
