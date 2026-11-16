# ModaFlow

Monorepo (npm workspaces) con la configuración inicial de ModaFlow:

Dos sistemas sobre una sola base de datos: el de los **suscriptores** (tiendas) y el de **administración**
(equipo de ModaFlow), con dominios, sesiones, cuentas y usuarios de PostgreSQL separados.

| Servicio    | Sistema        | Tecnología                                            | Carpeta          | Puerto (dev) |
|-------------|----------------|-------------------------------------------------------|------------------|--------------|
| `web`       | Suscriptores   | Next.js 16 (App Router) · React 19 · Tailwind 4 · shadcn/ui | `apps/web`  | 3000 |
| `api`       | Suscriptores   | NestJS 12 · Prisma 7 · Swagger (`dist/main.js`)       | `apps/api`       | 3001 |
| `admin-web` | Administración | Next.js 16 · mismo diseño (`@modaflow/ui`)            | `apps/admin-web` | 3002 |
| `admin-api` | Administración | NestJS 12, mismo proyecto que `api` (`dist/admin-main.js`) | `apps/api`  | 3003 (solo dev) |
| `migrate`   | Ambos          | Tarea única: migraciones, seed y usuarios de PostgreSQL | `apps/api`     | — |
| `postgres`  | Ambos          | PostgreSQL 18 (esquemas `public` y `admin`)           | —                | 5432 |

```text
modaflow/
├── apps/
│   ├── web/                 # Web de suscriptores (Next.js standalone) + Dockerfile
│   ├── admin-web/           # Web de administración (Next.js standalone) + Dockerfile
│   └── api/                 # NestJS + Prisma: API de suscriptores, API admin, CLI y migraciones
├── packages/
│   └── ui/                  # @modaflow/ui: componentes, estilos, formatos y tipos compartidos
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
| `SCHEDULER_ENABLED` | privada | admin-api | `false` desactiva el job de vencimientos en esa réplica (por defecto activo) |
| `APP_DB_PASSWORD` | **secreta** | migrate, api | Contraseña del usuario de PostgreSQL `modaflow_app` (API de suscriptores). Obligatoria en staging/producción, mínimo 16 caracteres |
| `ADMIN_DB_PASSWORD` | **secreta** | migrate, admin-api | Contraseña del usuario de PostgreSQL `modaflow_admin` (API admin). Obligatoria en staging/producción, mínimo 16 caracteres |
| `SETTINGS_ENCRYPTION_KEY` | **secreta** | api, admin-api | 64 caracteres hex (`openssl rand -hex 32`). Cifra las llaves guardadas desde el panel. Obligatoria en staging/producción. No cambiarla una vez en uso |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM_EMAIL` / `SMTP_FROM_NAME` | privada (contraseña **secreta**) | api, admin-api | Correo por defecto; lo configurado en el panel tiene prioridad |
| `ADMIN_WEB_URL` | privada | admin-api | URL pública del panel admin: enlaces de acceso del equipo y origen permitido |
| `ADMIN_SESSION_TTL_HOURS` / `ADMIN_SESSION_IDLE_MINUTES` | privada | admin-api | Duración máxima (8 h) e inactividad máxima (60 min) de la sesión del equipo |
| `ADMIN_API_INTERNAL_URL` | privada | admin-web | URL interna de la API admin (la fija cada compose) |

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
- Recuperación de contraseña: token de un solo uso (60 min), enviado por correo (SMTP configurado en el panel admin
  o en `SMTP_*`). Sin SMTP, en desarrollo el enlace se escribe en los logs de `api`; en producción solo se registra
  que el correo no se envió.

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
- El suscriptor nunca activa un plan de pago por sí mismo: desde la Etapa 6 envía una solicitud de pago con
  comprobante y un superadministrador la aprueba (ver Etapa 6).

**Endpoints** (ver Swagger): `/auth/*`, `/users/me`, `/onboarding`, `/stores/current`, `/plans`, `/subscription`,
`/health`.

## Arquitectura (Etapa 2: registro de prendas con IA e inventario)

**Productos y variantes**
- `Product` (modelo de prenda: precios en `Decimal(12,2)`, categoría, etiquetas, fotos) y `ProductVariant`
  (talla/color con su propio **stock** y SKU). Una prenda única o de fardo es una sola variante sin talla.
- SKU automático por tienda (`P00001`, variantes `P00001-M-ROJO`) y editable.
- **Límite del plan**: cuentan solo los productos **activos**; cada producto cuenta una vez sin importar sus
  variantes o unidades. Eliminar un producto libera el cupo. Las ediciones están permitidas
  aunque se alcance el límite, siempre que la suscripción esté activa. La comprobación bloquea la fila de la
  suscripción (`FOR UPDATE`), así que dos registros simultáneos no pueden superar el máximo.
- **Eliminar** (`DELETE /products/:id`): la tienda deja de ver el producto (inventario, punto de venta, catálogo) y
  libera su cupo, su código y su enlace del catálogo; no se puede deshacer. La fila (`status = DELETED`, `deleted_at`,
  `deleted_by_id`), sus fotos y su historial de ventas se conservan como registro.
- Las fotos analizadas con IA (`product_images.ai_scanned`) nunca se borran del almacenamiento, aunque se quiten del
  formulario o se elimine el producto: son el registro de lo que se envió a Claude.
- **Consumo en el panel admin** (`/consumo`): análisis con IA, tokens de entrada y salida y costo estimado en USD (precio
  de lista por modelo en [ai-pricing.ts](apps/api/src/admin/consumption/ai-pricing.ts)), productos creados y
  eliminados, fotos y almacenamiento por cuenta, y el registro de cada análisis con su foto (`/consumo/ia`).
  Endpoints: `GET /admin/consumption`, `/admin/consumption/accounts`, `/admin/consumption/ai-log`,
  `/admin/consumption/tenants/:id`.

**Inventario**
- El stock **solo** cambia con un `InventoryMovement` (entrada inicial, entrada de mercadería, salida manual,
  ajuste positivo y ajuste negativo). Cada movimiento guarda el stock anterior y el posterior, el motivo, la
  referencia, el usuario y la fecha.
- Cada movimiento bloquea la variante y su producto (`SELECT … FOR UPDATE`) dentro de una transacción. Las
  restricciones `CHECK` impiden el stock negativo y exigen `stock_after = stock_before ± cantidad`. Una clave de
  idempotencia evita duplicar un movimiento al reintentar.
- Los ajustes son solo para el propietario o el administrador; las entradas y salidas, para cualquier rol.

**Fotos (S3)**
- Se suben a `POST /product-images` (en el frontend pasan por `/api/product-images`, con la cookie de sesión).
  El backend decodifica la imagen real con `sharp`, acepta solo JPEG, PNG y WebP (máx. 10 MB), corrige la
  orientación, elimina los metadatos EXIF/GPS y guarda una versión WebP de 1600 px y una miniatura de 480 px.
- Las claves de los objetos son `tenants/{tenant}/products/{producto}/{imagen}-main.webp` y `-thumb.webp`. En
  PostgreSQL solo se guarda la referencia. El bucket es **privado**: el navegador recibe URLs firmadas de 1 hora.
- Las fotos subidas que nunca se guardan con un producto se eliminan a las 24 h.

**IA (Claude)**
- `POST /ai/analyze-garment` (1 a 3 fotos) envía las fotos optimizadas a Claude, con salida estructurada validada
  con zod. El esquema **no tiene campos** de precio, cantidad, marca ni composición, y la talla solo se informa si
  se lee en una etiqueta. Las sugerencias se sanean y quedan editables. La clave nunca sale del backend.
- Modelo configurable con `ANTHROPIC_MODEL` (por defecto `claude-opus-5-5`, esfuerzo `low`). Usa el *fallback*
  de servidor ante rechazos de seguridad cuando el modelo lo admite.
- **Créditos**: un análisis es 1 crédito, aunque incluya varias fotos. El crédito se reserva de forma atómica
  (`used < límite`), así que las solicitudes simultáneas nunca superan el plan. Si el análisis falla se devuelve
  el crédito, y un reintento con la misma clave devuelve el resultado guardado sin cobrar de nuevo. Los créditos
  mensuales se reinician cada mes contado desde el inicio de la suscripción; los de la prueba (10) no se reinician.
  Cada análisis queda registrado en `ai_analyses` con su estado y sus tokens.
- Sin `ANTHROPIC_API_KEY` el botón de IA se deshabilita con un aviso y la prenda se registra manualmente.

**Endpoints**: `/products`, `/products/:id`, `/products/:id/restore`, `/categories`, `/tags`, `/inventory`,
`/inventory/movements`, `/inventory/entries`, `/inventory/exits`, `/inventory/adjustments`, `/product-images`,
`/ai/analyze-garment`, `/ai/usage`.

**Frontend**: `/`, `/registro`, `/login`, `/recuperar-contrasena`, `/restablecer-contrasena`, `/onboarding`,
`/dashboard` (+ `productos`, `productos/nuevo`, `productos/[id]`, `productos/[id]/editar`, `productos/categorias`,
`inventario`, `inventario/movimientos`, `suscripcion`, `configuracion`, `cuenta`, `mas` y `reportes`). Mobile first: en el celular hay barra inferior y en escritorio una barra lateral.

### Costo estimado de la IA

Un análisis con 1 a 3 fotos usa del orden de 3.000 a 6.000 tokens de entrada y unos cientos de salida. Con
`claude-opus-5-5` ($4 / $20 por millón de tokens) son aproximadamente USD 0,02-0,04 por análisis, unos
**Bs 0,15-0,30**: 300 análisis del plan Premium costarían unos USD 6-12 al mes. Es una estimación y conviene
medirla con los tokens registrados en `ai_analyses`. Para reducir el costo se puede probar
`ANTHROPIC_MODEL=claude-haiku-5-5` (mucho más económico), comparando antes la calidad con fotos reales.

## Arquitectura (Etapa 3: punto de venta, ventas y boletas digitales)

**Punto de venta** (`/dashboard/ventas/nueva`, también desde el botón **Vender** de la barra inferior)
- Busca por nombre, SKU, categoría, etiqueta, color o talla. Solo muestra productos activos con stock; los
  agotados aparecen con "Mostrar agotados", marcados y sin poder agregarse.
- Una prenda con una sola variante (prenda única) se agrega con un toque; si tiene varias tallas o colores se
  elige la variante. El carrito no deja superar el stock disponible.
- El carrito vive en `sessionStorage` solo como borrador de la pantalla (no es dato de negocio): sobrevive a una
  recarga y se vacía al confirmar la venta.

**Montos y descuentos**
- Todo se calcula en **centavos enteros** (sin flotantes) con la misma lógica en el frontend y en la API
  (`sale-math.ts`). La API ignora cualquier precio o total enviado por el cliente y usa los precios vigentes.
- Orden fijo: precio → descuento por unidad de cada línea (porcentaje o Bs) → subtotal de líneas → descuento
  general (porcentaje o Bs) → total. Redondeo *half-up* a 2 decimales; ningún descuento puede dejar un monto negativo.
- Métodos de pago: efectivo (monto recibido opcional y cambio), QR bancario, transferencia y otro. No se genera
  ningún QR ni se integra con bancos: la vendedora **confirma explícitamente** que recibió el pago (`paymentConfirmed`).

**Confirmación de la venta (`POST /sales`)**
- Una sola transacción: bloquea productos y variantes en orden de id (`FOR UPDATE`, el mismo orden que usan los
  movimientos manuales y las anulaciones, para evitar *deadlocks*), recalcula, valida stock, toma el número y crea
  `Sale`, `SaleItem` (con *snapshot* de nombre, SKU, talla, color y precios) y un movimiento `SALE` por línea.
  Cualquier error revierte todo.
- **Numeración** `V-000001` por tienda con un contador atómico (`UPDATE tenants SET sale_seq = sale_seq + 1
  RETURNING`) dentro de la transacción: sin `count()`, sin duplicados y sin huecos por ventas revertidas.
- **Idempotencia**: cada cobro lleva una clave única por tienda; un reintento o un doble toque devuelve la misma venta.
- La base valida con `CHECK` que `total = subtotal − descuentos`, que cada línea sea coherente, que el pago esté
  confirmado y que todo movimiento `SALE`/`SALE_CANCEL` tenga su venta.

**Boletas**
- `/dashboard/ventas/[id]/boleta`: datos de la tienda, número, fecha, vendedor, prendas, descuentos, total, pago y la
  leyenda "Comprobante interno de venta. No es una factura fiscal." Se puede descargar en PDF (80 mm, generado en la
  API con `pdfkit`), imprimir, compartir por WhatsApp (`wa.me` con resumen y enlace, sin API oficial) o con el
  menú nativo del celular.
- **Enlace público** `/boleta/{token}`: token aleatorio de 192 bits que se crea al compartir. No expone ids ni datos
  internos (solo el nombre de pila del vendedor), es `noindex` y el propietario o el administrador puede desactivarlo.
  Un enlace desactivado o inexistente muestra "no encontrado" (en producción con código HTTP 200 por el *streaming*
  de Next, pero sin ningún dato de la venta).

**Historial y anulación**
- `/dashboard/ventas`: tarjetas en el celular y tabla en escritorio; filtros por hoy, ayer, últimos 7 días, mes,
  rango personalizado, estado, método y número; paginación en el backend. Fechas en hora de Bolivia (UTC−4).
- `/dashboard/ventas/[id]`: detalle con movimientos de inventario. **Anular** (por ahora solo el propietario; los
  roles están en `SALE_CANCEL_ROLES` para habilitar a administradores) pide motivo, bloquea la venta, restituye el
  stock con movimientos `SALE_CANCEL` y registra `SaleCancellation`, todo en una transacción e idempotente. Una
  venta no se anula dos veces ni se borra. **Anular no devuelve el dinero**: la devolución se gestiona aparte.
- El inicio del panel muestra ventas de hoy, total, prendas vendidas y las últimas ventas (los totales excluyen
  las anuladas).
- Con la suscripción vencida no se pueden registrar ni anular ventas; el historial y las boletas siguen visibles.

**Endpoints**: `GET /pos/products`, `POST /pos/preview`, `GET|POST /sales`, `GET /sales/:id`,
`POST /sales/:id/cancel`, `GET /sales/:id/receipt`, `GET /sales/:id/receipt/pdf`,
`POST|DELETE /sales/:id/receipt-link`, `GET /receipts/:token` y `GET /receipts/:token/pdf` (públicos, con límite de
solicitudes) y `GET /dashboard/sales-summary`. Documentados en Swagger.

**Frontend**: `/dashboard/ventas/nueva`, `/dashboard/ventas`, `/dashboard/ventas/[id]`, `/dashboard/ventas/[id]/boleta`,
`/boleta/[token]` (pública) y las rutas proxy `/api/sales/[id]/receipt-pdf` y `/api/receipts/[token]/pdf`.

## Arquitectura (Etapa 4: reportes, estadísticas y análisis de ventas)

**Periodos y zona horaria**
- Hoy, ayer, esta semana, semana anterior, últimos 7 días, esta quincena (1-15 / 16-fin de mes), quincena anterior,
  este mes, mes anterior, últimos 30 días, este año y personalizado (inicio ≤ fin, máximo 2 años).
- Las fechas se guardan en UTC y los días se calculan en la zona horaria de la tienda (`stores.timezone`, por defecto
  `America/La_Paz`, editable en Configuración), sin depender de la zona del servidor. Los filtros se aplican en PostgreSQL.
- **Comparación**: con el periodo anterior equivalente. Si el periodo está en curso se compara el mismo tiempo
  transcurrido (este mes hasta hoy a esta hora vs. el mes anterior hasta el mismo día y hora). Si el anterior es 0
  se muestra "Sin base de comparación" en lugar de un porcentaje infinito.

**Indicadores**: total vendido, ventas, prendas, ticket promedio (total / ventas, redondeo al centavo), descuentos
(por prenda + general, cada uno una vez). Las ventas anuladas nunca suman; se informan aparte. Todo en centavos enteros.

**Costos históricos y ganancia bruta estimada**
- Cada línea de venta guarda `unit_cost` (precio de compra al momento de vender), `net_total` (total de la línea
  después de repartir el descuento general; la suma por venta es exactamente el total) y la categoría al vender.
  Cambiar después el precio de compra no altera ventas pasadas.
- Ganancia bruta estimada = ventas netas − costo de compra registrado. Las prendas sin costo **no** se toman como
  costo cero: se excluyen, se informan (unidades e ingresos sin costo) y el resultado se marca como parcial. No incluye
  gastos, impuestos ni comisiones.
- La migración rellena `net_total` con la regla del API a partir de los montos guardados y la categoría actual; los
  costos de ventas anteriores quedan vacíos porque no hay registro verificable del costo de ese momento.

**Reportes**: `/dashboard/reportes` (indicadores, evolución, productos, categorías, métodos de pago, inventario),
`/reportes/ventas` (tabla paginada en el backend con filtros por método, vendedor, estado y número, y orden por fecha),
`/reportes/productos` (ranking por prendas o ingresos, menos vendidos, variantes, categorías, ganancia por producto) y
`/reportes/inventario` (activos, unidades, agotados, stock bajo con umbral configurable, valor a costo y a precio de
venta, movimientos del periodo). El periodo se conserva al cambiar de vista. Las prendas únicas (talla única que solo
recibió 1 unidad) no cuentan como stock bajo salvo que se pida.

**Gráficos**: Recharts. Barras del periodo con línea punteada del periodo anterior (mismo eje), rankings horizontales
de un solo color con etiquetas directas, tooltips, estados vacíos y vista de tabla. Agrupación por hora (1 día), día
(≤ 62 días), semana o mes. Colores validados para daltonismo y contraste: `#6C4CF5` (actual) y `#D63C74` (anterior).

**Exportaciones**: Excel (ExcelJS en streaming, lotes por cursor, importes numéricos con formato Bs, fechas locales,
totales, filtros y protección contra inyección de fórmulas) y PDF (pdfkit, A4, tablas paginadas, totales, gráfico de
barras, numeración de páginas; máximo 2.000 filas, el detalle completo va en Excel). Mismos filtros y permisos que la
pantalla; el navegador descarga por `/api/reports/export` con la cookie de sesión.

**Planes y roles**: los reportes básicos (indicadores, tabla de ventas, conteos de inventario) están en todos los planes
y siguen legibles con la suscripción vencida. Los avanzados (ganancia, comparación, gráficos, productos, valor del
inventario, movimientos y exportaciones) requieren `advancedReports` (Gratis durante la prueba, Pro y Premium); la API
responde `FEATURE_NOT_IN_PLAN` o `SUBSCRIPTION_INACTIVE`. Solo propietario y administrador ven reportes
(`FORBIDDEN_ROLE` para vendedores). No hay reportes por sucursal todavía.

**Endpoints**: `GET /reports/summary`, `/reports/sales`, `/reports/inventory`, `/reports/products`,
`/reports/sales-chart`, `/reports/categories`, `/reports/payment-methods`, `/reports/export/excel`,
`/reports/export/pdf` y `GET /dashboard/sales-summary` (hoy, mes, últimas ventas y stock bajo). La comparación va
dentro de `/reports/summary`. Documentados en Swagger.

**Organización del código**: API `apps/api/src/reports` con servicios por responsabilidad (contexto y periodo,
estadísticas de ventas, tabla de ventas, productos, inventario, inicio, exportación Excel/PDF) y lógica pura
probada sin base de datos (`report-periods`, `report-spans`, `report-buckets`, `report-math`, `common/zoned-time`).
Web: `src/types/reports.ts` (tipos), `src/config/reports.ts` (declaraciones), `src/lib/reports.ts` (funciones puras),
`src/services/reports.ts` (I/O), `src/components/reports/*` (presentación) y páginas que solo componen.

## Arquitectura (Etapa 5: catálogo online, pedidos por WhatsApp y QR)

**Catálogo público** en `/{slug}`, directo en el dominio (los enlaces antiguos `/tienda/{slug}` redirigen; mayúsculas, espacios y tildes escritos a mano se corrigen solos; los nombres de páginas del sistema están reservados) (sin registro): portada, logotipo, descripción, ciudad, botón de WhatsApp,
búsqueda (nombre, categoría, color, talla, etiquetas), filtros (categoría, talla, color, rango de precio,
disponibilidad), orden (recientes, precio, nombre) y paginación en el backend (24 por página). Detalle en
`/{slug}/producto/{productSlug}` con galería (miniaturas y vista ampliada), variantes disponibles y cantidad
limitada al stock informado. También `/categorias`, `/carrito` e `/info`. Plantilla única adaptada con el color
principal y secundario de cada tienda (MioShop es solo un ejemplo de personalización).

**Conectado al inventario real**: no hay inventario aparte. Cada producto tiene `catalog_published` (publicar u ocultar,
individual o masivo, no cambia stock ni estado) y un `slug` público único por tienda (nombre + SKU). Solo se muestran
productos activos y publicados; los agotados se muestran como "Agotado" o se ocultan según la configuración y nunca
pueden pedirse. La API pública no expone ids internos, costos, stock exacto (se informa hasta 10) ni datos de vendedores.

**Carrito y WhatsApp**: el carrito vive en `localStorage` del comprador (es solo una selección, no reserva ni descuenta
stock). "Pedir por WhatsApp" valida en el backend productos, variantes y stock con precios vigentes, registra una
`CatalogOrderRequest` (código aleatorio, productos, variantes, cantidades, precios y total referencial), muestra el
mensaje para revisarlo y abre `wa.me/{whatsapp de la tienda}`. Al tocar "Abrir WhatsApp" la solicitud pasa a "WhatsApp
abierto" (acción iniciada con un token de un solo uso; no se afirma que el mensaje llegó). Nunca se crea una venta ni se
descuenta stock: la venta se registra en el punto de venta. `sale_id` queda preparado para vincularlas en el futuro.

**Panel**: `/dashboard/catalogo` (estado, enlace, ver/copiar/compartir, QR descargable en PNG y SVG con solo la URL
pública, indicadores reales), `/configuracion` (nombre, dirección validada y no reservada, descripción, logotipo,
portada, colores, WhatsApp, mensaje predeterminado, agotados, publicado/oculto), `/productos` (publicación masiva),
`/solicitudes` y su detalle (atendida/cancelada). La ficha de producto tiene "Mostrar en catálogo online".

**Planes**: catálogo en Gratis (solo durante la prueba), Pro y Premium; Básico no. NestJS valida el plan en cada consulta
pública y en cada cambio. Si la suscripción vence o el plan no lo incluye, el catálogo muestra una página neutral
"Catálogo no disponible" (sin datos de facturación, `noindex`; en producción con HTTP 200 por el *streaming* de Next) y se
conservan productos, fotos, publicación y configuración.

**SEO**: metadatos dinámicos, URL canónica y Open Graph/Twitter por tienda y producto (imagen estable
`/{slug}/imagen` y `/producto/{slug}/imagen` que redirige a la foto firmada), `sitemap.xml` dinámico solo con
catálogos disponibles y productos publicados, y `robots.txt` que excluye panel, API, boletas y carrito.

**Rendimiento**: consultas paginadas con índices (`products(tenant_id, catalog_published, status, created_at)`, slug
único por tienda), miniaturas WebP, `loading="lazy"` y prioridad para las primeras fotos. Las páginas públicas se
renderizan por solicitud sin caché de datos de negocio, así que una venta, un cambio de stock, archivar, publicar u
ocultar o un cambio de plan se reflejan de inmediato sin invalidaciones manuales.

**Endpoints públicos** (`@Public`, límite 120/min; creación de solicitudes 10/min): `GET /public/stores/:slug`,
`/categories`, `/products`, `/products/:productSlug`, `POST /public/stores/:slug/order-requests`,
`POST /public/stores/:slug/order-requests/:code/whatsapp` y `GET /public/sitemap`. **Privados**: `GET|PATCH
/catalog/settings`, `GET /catalog/slug-availability`, `POST|DELETE /catalog/media/:kind`, `GET /catalog/summary`,
`GET /catalog/products`, `PATCH /catalog/products/:id`, `POST /catalog/products/bulk-update`,
`GET /catalog/order-requests`, `GET|PATCH /catalog/order-requests/:id`.

## Arquitectura (Etapa 6: superadministración, suscripciones, pagos manuales y auditoría)

**Equipo de ModaFlow**: desde la separación de sistemas (ver la sección siguiente) el personal vive en
`admin.staff` (roles `SUPERADMIN` y `SUPPORT` de solo lectura), con su propio login en el sistema de administración.
Los endpoints de administración usan `@AdminArea()` (lectura, ambos roles) o `@SuperadminOnly()` (acciones).

**Planes versionados**: los planes se editan en el panel admin (`/planes`). Cambiar precio, límites o funciones crea una nueva
`plan_versions`; cada suscripción guarda la versión contratada (`subscriptions.plan_version_id`) y los límites salen de
esa versión, así que un cambio de precio no altera periodos ya contratados. La versión nueva se aplica al renovar,
activar o cambiar de plan.

**Reglas de renovación** ([billing-rules.ts](apps/api/src/billing/billing-rules.ts)), periodos mensuales por mes de
calendario:
- *Renovación* (plan de pago activo, mismo plan): el periodo nuevo empieza en el vencimiento vigente.
- *Activación* (en prueba o vencido): empieza en el momento de la aprobación.
- *Cambio de plan* (plan de pago activo a otro plan): inmediato, sin prorrateo.
- Una suscripción `SUSPENDED` no admite pagos ni cambios hasta reactivarla. Cada cambio se valida, se guarda en
  `subscription_history` y en la auditoría; cada pago aprobado crea un `subscription_periods` (único por solicitud).

**Pagos manuales** (sin pasarela): QR bancario de ModaFlow (imagen en S3) y transferencia, configurados en
`/configuracion?tab=pagos` del panel admin. Flujo del suscriptor en `/dashboard/suscripcion`: crear solicitud → ver instrucciones
con el importe → subir comprobante → confirmar → revisión. El importe lo calcula siempre el servidor desde la versión
vigente del plan (nunca del navegador). La aprobación es transaccional: bloquea la fila, exige estado `PENDING` y
comprobante enviado; una segunda aprobación responde 409 `PAYMENT_ALREADY_REVIEWED`. Solo se admite una solicitud
pendiente por negocio. Los registros financieros no se pueden borrar desde la interfaz.

**Ingresos y métricas** (inicio y `/estadisticas` del panel admin): ingresos = suma de `amount_confirmed` de pagos aprobados;
MRR = precios mensuales de las versiones contratadas de suscripciones de pago activas; ARPU = MRR / negocios que pagan;
además conversión de prueba a pago, altas, vencimientos y uso agregado (sin datos individuales de las tiendas).

**Vencimientos**: un job cada 10 minutos (`@nestjs/schedule`, con *advisory lock* de PostgreSQL y
`FOR UPDATE SKIP LOCKED`, seguro con varias réplicas) marca suscripciones vencidas y genera avisos de vencimiento
próximo. La autorización **no depende del job**: `EntitlementsService` calcula el estado efectivo en cada petición.
El job corre en `admin-api`; `SCHEDULER_ENABLED=false` lo desactiva en una réplica.

**Notificaciones**: dentro de la plataforma (`/dashboard/notificaciones` y `/notificaciones` del panel admin), deduplicadas con
`dedupe_key` único. Con SMTP configurado (panel admin → Configuración → Correo) los avisos también se envían por
correo (en copia oculta) desde el job de `admin-api`; sin SMTP se marcan `SKIPPED`.

**Auditoría** (`/auditoria` del panel admin): `admin.audit_logs` es de solo inserción (un *trigger* de PostgreSQL rechaza
`UPDATE` y `DELETE`). Guarda actor, acción, entidad, antes/después, motivo, IP y resultado; elimina claves sensibles
(contraseñas, hashes, tokens, claves) antes de guardar. Suspender negocios o usuarios, extender pruebas y revisar
pagos exige motivo.

**Configuración general** (`platform_settings`, fila única): nombre, contacto, zona horaria, días de prueba, aviso y
conservación, datos de pago y correos de aviso. S3, Claude y SMTP se editan en sus propias pestañas (ver
"Integraciones desde el panel"). La contraseña de la base de datos y la clave de cifrado solo existen en el servidor.

**Fuera de alcance**: pasarelas de pago, cobro recurrente automático, facturación fiscal, WhatsApp Business API,
acceso a la cuenta de un suscriptor (impersonación) y borrado permanente de negocios.

**Endpoints** (Swagger de cada API): suscriptor `GET /subscription/payment-info`,
`GET|POST /subscription/payment-requests`, `GET /subscription/payment-requests/:id`,
`POST /subscription/payment-requests/:id/receipt|submit|cancel`, `GET /subscription/periods`,
`GET /notifications`, `POST /notifications/read-all`, `POST /notifications/:id/read`. Administración:
`GET /admin/dashboard`, `/admin/statistics`, `/admin/audit`, `/admin/notifications`,
`POST /admin/notifications/:id/read`, `POST /admin/jobs/subscription-expiry` (ejecución manual del job);
`GET /admin/tenants`, `/admin/tenants/:id`, `PATCH /admin/tenants/:id/status`; `GET /admin/users`, `/admin/users/:id`,
`PATCH /admin/users/:id/status`; `GET /admin/plans`, `/admin/plans/:id/versions`, `PATCH /admin/plans/:id`;
`GET /admin/subscriptions`, `/admin/subscriptions/:id`, `POST /admin/subscriptions/:id/renew|change-plan`
(pago manual registrado por el administrador), `POST /admin/subscriptions/:id/extend-trial`,
`POST /admin/subscriptions/:id/suspend|reactivate|cancel`; `GET /admin/payments`, `/admin/payments/:id`,
`POST /admin/payments/:id/approve|reject`; `GET|PATCH /admin/settings`, `POST /admin/settings/payment-qr`.

## Arquitectura (sistemas separados: suscriptores y administración)

**Dos sistemas, una base de datos.** La web de suscriptores (`modaflow.amicornios.com`) y la de administración
(`admin.modaflow.amicornios.com`) son aplicaciones, procesos y contenedores distintos. Comparten PostgreSQL para que
las operaciones críticas sigan siendo una sola transacción (aprobar un pago actualiza suscripción, periodo y auditoría
a la vez) sin sincronizar datos entre sistemas.

```text
admin.modaflow…  admin-web ──(red privada)──► admin-api ──┐ usuario modaflow_admin
modaflow…        web ───────(red privada)──► api ─────────┤ usuario modaflow_app
                                                          ▼
                       PostgreSQL: esquema public (negocios, usuarios, ventas, pagos)
                                   esquema admin  (equipo, sesiones del equipo, auditoría)
```

- **Cuentas separadas**: el equipo vive en `admin.staff`, no en `users`. Una cuenta de tienda no sirve en el panel
  admin y viceversa. `users.global_role` ya no existe.
- **Sesiones separadas**: cookie `mf_admin_session` (HttpOnly, `SameSite=Strict`) en el dominio admin, con duración
  máxima de 8 h y cierre por inactividad de 60 min. Bloqueo tras 5 intentos fallidos. Contraseñas del equipo de
  12 caracteres como mínimo.
- **La API admin no tiene dominio público**: solo `admin-web` la llama por la red interna de Docker.
- **La API de suscriptores no contiene código de administración**: `src/admin/**` solo se carga en `admin-main.ts`, y
  una regla de lint (`no-restricted-imports` en `.oxlintrc.json`) impide importarlo desde el resto.
- **Separación impuesta por PostgreSQL** (migración `20261115220000_admin_schema_staff`):

  | Usuario | Lo usa | Puede | No puede |
  |---|---|---|---|
  | `modaflow` (dueño) | solo `migrate` | todo | — |
  | `modaflow_app` | `api` | sus datos; crear la suscripción al registrarse | ver el esquema `admin`; cambiar plan, estado o fechas de una suscripción; editar planes, versiones o configuración; aprobar pagos; borrar historial financiero |
  | `modaflow_admin` | `admin-api` | esquema `admin` (auditoría solo inserción); leer datos de negocio; operar suscripciones, pagos, planes y configuración; suspender usuarios | leer contraseñas o tokens de los clientes; borrar negocios, ventas o registros financieros; modificar la auditoría |

- **Primer acceso del equipo** (no hay usuarios ni contraseñas por defecto). El CLI corre en el contenedor
  `admin-api`, crea al miembro y entrega un **enlace de un solo uso** (24 h) para que elija su contraseña en
  `/acceso`. La contraseña nunca pasa por la terminal:

  ```bash
  docker compose -f deploy/development/compose.yaml exec admin-api npm run staff -- invite persona@empresa.com --name "Nombre Apellido"
  # Producción (Coolify → servicio admin-api → Terminal):
  node dist/cli/staff.js invite persona@empresa.com --name "Nombre Apellido" [--role SUPPORT]
  node dist/cli/staff.js reset persona@empresa.com     # nuevo enlace (olvido de contraseña); cierra sus sesiones
  node dist/cli/staff.js disable persona@empresa.com   # no permite dejar sin superadministradores
  node dist/cli/staff.js enable persona@empresa.com
  node dist/cli/staff.js list
  ```

  Cada miembro puede cambiar su contraseña en **Mi cuenta** (`/cuenta`); se cierran sus otras sesiones.
- **Sección Equipo** (`/equipo` del panel admin): ambos roles ven al equipo (rol, estado, invitación pendiente,
  bloqueo, último ingreso y sesiones abiertas; nunca contraseñas). Un superadministrador además puede invitar (genera
  el mismo enlace de un solo uso que el CLI y lo muestra una sola vez), generar un enlace nuevo, cambiar el rol y
  desactivar o reactivar, siempre con motivo y auditoría. Nadie puede cambiar su propio rol ni desactivarse, y la base
  bloquea quedarse sin superadministradores activos. El CLI sigue siendo la vía para crear el primer acceso.
- **Migración de datos**: los superadministradores existentes pasaron a `admin.staff` con el mismo id y la misma
  contraseña, la auditoría se movió a `admin.audit_logs` sin perder filas, y las columnas de autoría (revisó el pago,
  creó la versión, registró el periodo, editó la configuración) apuntan ahora a `admin.staff`. El historial de
  suscripciones distingue `actor_id` (cliente) de `actor_staff_id` (equipo).
- **Código compartido**: `packages/ui` (`@modaflow/ui`) contiene componentes base (shadcn), estilos, formularios,
  formatos, gráficos, etiquetas de facturación y tipos comunes. Ambas webs lo compilan con `transpilePackages`.

**Integraciones desde el panel** (Configuración → Almacenamiento, IA (Claude), Correo). Por decisión del dueño del
producto, S3, la llave de Claude y el SMTP se pueden cambiar desde el panel en todos los entornos, con estas defensas:

- Tabla `integration_settings` (fila única). Cada campo vacío usa su variable de entorno (`S3_*`, `ANTHROPIC_*`,
  `SMTP_*`), así un despliegue nuevo funciona sin tocar el panel.
- Las llaves se guardan **cifradas** (AES-256-GCM) con `SETTINGS_ENCRYPTION_KEY`, que solo vive en el servidor. Son de
  **solo escritura**: la API nunca las devuelve; el panel muestra "guardada · termina en ••ab12" y permite reemplazarlas
  o quitarlas. Una copia de la base no expone las llaves.
- Solo superadministradores, **repitiendo su contraseña** para probar, guardar o restablecer (límite 10/min). Soporte
  solo ve el estado. Cada cambio y cada prueba quedan en la auditoría con los nombres de los campos, nunca los valores.
- **Probar conexión** sin guardar: S3 sube y borra un archivo; Claude valida llave y modelo con `models.retrieve` (sin
  consumir tokens); SMTP verifica la conexión y envía un correo de prueba a quien lo pide.
- Ambas APIs leen la configuración con caché de 15 s: un cambio llega a las tiendas en menos de 15 segundos sin
  reiniciar. La API de suscriptores solo puede **leer** esa tabla (permiso de PostgreSQL).
- Si se pierde o cambia `SETTINGS_ENCRYPTION_KEY`, las llaves guardadas no se pueden leer: esa sección se desactiva, el
  panel lo avisa y hay que volver a ingresarlas. **No cambies esa clave una vez en uso.**

**Endpoints de la API admin** (además de los de administración de la Etapa 6): `POST /auth/login`, `POST /auth/logout`,
`GET /auth/me`, `POST /auth/setup-password` (enlace de un solo uso), `POST /auth/password` (cambio propio),
`GET|POST /admin/staff`, `POST /admin/staff/:id/setup-link`, `PATCH /admin/staff/:id` (rol o estado, con motivo),
`GET /admin/integrations`, `PATCH /admin/integrations/storage|ai|email`, `POST /admin/integrations/storage|ai|email/test`
y `POST /admin/integrations/:section/reset`.

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

- Al iniciar, el servicio `migrate` aplica migraciones, carga los planes que falten y asigna las contraseñas de los
  usuarios `modaflow_app` y `modaflow_admin` (en desarrollo con valores por defecto solo locales). Después arrancan
  `api` y `admin-api`, cada uno con su usuario.
- Si `docker compose ... up --build` falla con `failed to execute bake`, construye las imágenes con
  `docker buildx build --target dev -f apps/api/Dockerfile -t modaflow-dev-api -t modaflow-dev-admin-api -t modaflow-dev-migrate .`
  (y lo mismo para `apps/web` y `apps/admin-web`) y luego `docker compose ... up -d --no-build`.
- **Hot reload**: se montan `apps/web/src`, `apps/admin-web/src`, `packages/ui/src`, `apps/api/src`, `apps/api/prisma` y `apps/api/test`.
  Los cambios en esas carpetas se recargan solos. Si cambias dependencias (`package.json`) o archivos de
  configuración (`next.config.ts`, `tsconfig.json`...), reconstruye con `up -d --build`.
- En Docker Desktop (Windows/macOS) los bind mounts no propagan eventos de archivos, por lo que el compose
  de desarrollo activa *polling* (`WATCH_POLL_INTERVAL_MS`, `TSC_WATCHFILE`). Para la mejor experiencia de
  Next.js puedes ejecutar `web` en el host (ver abajo).

### Accesos en desarrollo

| Qué | URL |
|---|---|
| Web de suscriptores | http://localhost:3000 |
| Web de administración | http://localhost:3002 (login del equipo en `/login`) |
| API de suscriptores | http://localhost:3001 |
| API admin (Swagger solo en desarrollo) | http://localhost:3003/docs (solo en `127.0.0.1`) |
| Health check | http://localhost:3001/health |
| Swagger UI | http://localhost:3001/docs (JSON: `/docs-json`) |
| PostgreSQL | `localhost:5432` (solo en `127.0.0.1`), usuario/contraseña de `.env`, base `modaflow` |
| S3 local (SeaweedFS) | `http://localhost:8333` (solo en `127.0.0.1`), bucket `modaflow-dev`, claves `modaflow-dev` / `modaflow-dev-secret` |

El compose de desarrollo incluye un servicio `storage` (SeaweedFS 4.53, compatible con S3) para probar las fotos
de verdad sin un proveedor externo. Solo existe en desarrollo; en producción se usa un S3 externo.

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
PORT=3003 npm run dev:admin-api               # API admin; necesita DATABASE_URL del usuario modaflow_admin
npm run dev:admin-web                         # http://localhost:3002
```

Otros comandos: `npm run build`, `npm run lint`, `npm run prisma:generate`.

## Pruebas

```bash
# Unitarias (planes, prueba gratuita, límites, guards, login/bloqueo, WhatsApp, montos y fechas de ventas)
npm test -w @modaflow/api

# E2E contra PostgreSQL real, en una base de datos separada *_test (se niegan a ejecutarse en otra)
docker compose -f deploy/development/compose.yaml exec postgres sh -c 'createdb -U "$POSTGRES_USER" modaflow_test'
cd apps/api
export DATABASE_URL="postgresql://modaflow:<password>@localhost:5432/modaflow_test?schema=public"
npx prisma migrate deploy && npx prisma db seed
npm run test:e2e        # requiere también el servicio `storage` en localhost:8333 (bucket modaflow-test)
```

Las pruebas e2e cubren:
- **Etapa 1:** registro, login y logout, bloqueo por intentos, CSRF por origen, recuperación de contraseña,
  protección de rutas, onboarding transaccional, prueba de 14 días (y que no se reinicia), planes, días restantes,
  edición de la tienda, aislamiento entre tenants, solicitudes de cambio de plan y modo de solo lectura al vencer.
- **Etapa 2:** subida de fotos a S3 (optimización, URLs firmadas, acceso sin firma denegado, rechazo de archivos
  que no son imágenes), registro manual con variantes, prenda única, validaciones, edición, búsqueda y filtros,
  entradas, salidas y ajustes, historial consistente, salidas simultáneas sin stock negativo, límite de productos
  con solicitudes simultáneas, archivado y restauración, suscripción vencida, categorías sin duplicados,
  aislamiento entre tiendas y créditos de IA (cobro, idempotencia, reembolso al fallar y límite con concurrencia).
- **Etapa 3:** búsqueda del POS, preview y montos, rechazo de precios enviados por el cliente, venta con snapshot
  y movimientos, confirmación de pago y efectivo insuficiente, idempotencia concurrente, última unidad con 5
  vendedores simultáneos, 8 ventas simultáneas con números consecutivos únicos, *rollback* completo, productos
  archivados, boleta JSON/PDF y enlace público revocable, anulación concurrente con restitución de stock,
  permisos por rol, historial con filtros y paginación, aislamiento entre tiendas y suscripción vencida.
- **Etapa 4:** reportes sin ventas, totales/descuentos/ticket/prendas contra las ventas guardadas, exclusión de
  anuladas, costos históricos (cambiar el precio de compra no altera ventas pasadas), ganancia con costos faltantes,
  límites de día/semana/quincena/mes en la zona de la tienda, periodo personalizado, comparación, ranking de productos,
  métodos de pago, inventario y stock bajo, Excel (números, totales, anti-fórmulas) y PDF, restricciones por plan y rol,
  aislamiento entre tiendas y 20.000 ventas sintéticas (consultas < 3 s, Excel en streaming).
- **Etapa 5:** configuración y slugs (únicos, formato, reservados), publicación individual y masiva sin cambiar stock,
  consulta pública anónima sin datos privados, búsqueda, filtros, orden y paginación, detalle y variantes, agotados
  (mostrar/ocultar), solicitudes con precios del servidor, mensaje y enlace de WhatsApp, stock sin cambios, token de
  "WhatsApp abierto", catálogo oculto, sitemap, planes (Básico, Pro, prueba vencida) y aislamiento entre tiendas.
- **Etapa 6:** acceso a `/admin` por rol global (dueño y soporte), sin autoasignación de privilegios, protección del
  último superadministrador, suspensión de usuarios y negocios con cierre de sesiones, solicitud de pago con importe
  del servidor, comprobante en S3, una sola pendiente por negocio, aprobación concurrente (una 200 y dos 409, un solo
  periodo), rechazo, renovación desde el vencimiento vigente, activación desde la aprobación, cambio de plan,
  suspensión, reactivación, cancelación, extensión de prueba con motivo, versionado de precios sin alterar lo
  contratado, job de vencimientos idempotente sin avisos duplicados, auditoría inmutable sin datos sensibles,
  ingresos solo de pagos aprobados, MRR/ARPU y configuración sin secretos.

- **Sistemas separados:** cada API corre en las pruebas con su propio usuario de PostgreSQL (`current_user` verificado);
  sin rutas `/admin` en la API de suscriptores; cookies y cuentas no intercambiables; enlace de acceso de un solo uso;
  contraseñas fuertes del equipo; bloqueo tras intentos fallidos; cambio de contraseña; soporte de solo lectura; y
  pruebas SQL directas de lo que cada usuario de PostgreSQL no puede hacer (`test/db-roles.e2e-spec.ts`).

Los archivos e2e se ejecutan uno tras otro (`fileParallelism: false`) porque comparten la misma base de datos de prueba.
`DATABASE_URL` debe ser el dueño de `modaflow_test` (para preparar datos); las apps se conectan con `modaflow_app` y
`modaflow_admin` usando `APP_DB_PASSWORD` y `ADMIN_DB_PASSWORD` (por defecto, las de desarrollo). La primera vez,
asigna esas contraseñas en la base de prueba con `npm run db:roles -w @modaflow/api` (con `DATABASE_URL` de prueba).

En las pruebas de créditos, el modelo de visión se reemplaza por un **doble de prueba**: se prueba la lógica real de
créditos y no se simula a Claude. La llamada real a Claude tiene su propia prueba, que solo se ejecuta con clave:

```bash
ANTHROPIC_API_KEY=sk-ant-... AI_TEST_IMAGE=/ruta/a/foto-de-prenda.jpg npm run test:e2e
```

Componentes de shadcn/ui: `cd apps/web && npx shadcn@latest add <componente>` (se guardan en `packages/ui`, compartidos por ambas webs).

## Prisma

- Configuración: [apps/api/prisma7.config.ts](apps/api/prisma7.config.ts) (nombre de archivo propio de Prisma 7.10) y
  [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma).
- Modelos: `User`, `Session`, `PasswordResetToken`, `Tenant`, `TenantMembership`, `Store`, `Plan`, `Subscription`,
  `SubscriptionUsage`, `TrialGrant` y `PlanChangeRequest` (Etapa 1); `Category`, `Tag`, `ProductTag`, `Product`,
  `ProductVariant`, `ProductImage`, `InventoryMovement` y `AiAnalysis` (Etapa 2); `Sale`, `SaleItem` y
  `SaleCancellation` (Etapa 3); costos históricos, total neto y categoría en `SaleItem` y zona horaria en `Store`
  (Etapa 4); `CatalogSettings`, `CatalogOrderRequest`, `CatalogOrderRequestItem`, y `slug`/`catalogPublished` en
  `Product` (Etapa 5); `PlanVersion`, `SubscriptionPeriod`, `SubscriptionHistory`, `AdminAuditLog`, `Notification`,
  `PlatformSettings`, rol global y estado en `User`, y campos de pago y revisión en `PlanChangeRequest` (Etapa 6).
  Todos con claves foráneas,
  índices (incluidos índices trigram `pg_trgm` para la búsqueda) y restricciones `CHECK`.
- Migraciones: `20261115015333_init_tenancy_and_subscriptions`, `20261115030329_catalog_inventory_ai`,
  `20261115040424_sale_movement_types`, `20261115040539_sales_pos_receipts`, `20261115120000_reports_costs_timezone`, `20261115180000_online_catalog` (rellena
  el slug de los productos existentes), `20261115200000_subscription_suspended` (valor de enum, aparte) y
  `20261115200100_saas_admin_billing` (crea la versión 1 de cada plan, enlaza las suscripciones existentes, registra los
  periodos de prueba vigentes, la configuración inicial, las restricciones `CHECK` y el *trigger* de auditoría) y
  `20261115220000_admin_schema_staff` (esquema `admin`, equipo, sesiones, traslado de la auditoría y usuarios de
  PostgreSQL con permisos; corre dentro de una transacción). Desde la segunda solo agregan tablas,
  valores de enum, columnas con valor por defecto o nulas (`tenants.product_seq`, `tenants.sale_seq`,
  `inventory_movements.sale_id`) y restricciones, sin cambios destructivos. Los valores nuevos del enum de
  movimientos van en una migración aparte porque PostgreSQL no permite usarlos en la misma transacción que los crea.
- No se usa `prisma db push`: los cambios de esquema van siempre como migraciones versionadas.
- Migraciones versionadas en `apps/api/prisma/migrations`. Al arrancar, el contenedor `api` (desarrollo y
  producción) ejecuta `prisma migrate deploy` (solo aplica migraciones pendientes, nunca borra datos) y el seed de planes.
- Nueva migración en desarrollo: `npm run prisma:migrate:dev -w @modaflow/api -- --name <nombre>`.
- Seed manual: `npm run prisma:seed -w @modaflow/api`. Es idempotente y desde la Etapa 6 solo **crea** lo que falta
  (planes con su versión 1 y la fila de configuración): no sobrescribe precios ni planes editados en `/admin/planes`.
  No crea usuarios ni superadministradores.
- Prisma 7 usa *driver adapters*: la conexión se hace con `@prisma/adapter-pg` ([prisma.service.ts](apps/api/src/prisma/prisma.service.ts)).
- El cliente se genera en `apps/api/src/generated/prisma` (ignorado por git) con `npm run prisma:generate`;
  `npm run build` y el contenedor de desarrollo lo generan automáticamente.

## Producción y Coolify

[deploy/production/compose.yaml](deploy/production/compose.yaml) construye imágenes multi-stage:

- **web** y **admin-web**: Next.js `output: "standalone"`, usuario no root, sin `node_modules` completos.
- **api** y **admin-api**: la misma imagen NestJS compilada (`dist/main.js` y `dist/admin-main.js`), cada una con su
  usuario de PostgreSQL. `admin-api` no tiene dominio.
- **migrate**: tarea única en cada despliegue (`prisma migrate deploy`, seed de planes faltantes y contraseñas de los
  usuarios restringidos). Es el único servicio con la contraseña del dueño de la base. Termina con código 0 y las APIs
  arrancan después (`service_completed_successfully`).
- **postgres**: volumen persistente `postgres_data`, **sin puertos publicados** (solo red interna `modaflow`).
- Healthchecks en los servicios permanentes y `restart: unless-stopped`.
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
   | `admin-web` | `https://admin.modaflow.amicornios.com:3000` |
   | `admin-api` | *(ninguno — solo red interna)* |
   | `migrate` | *(ninguno — tarea única)* |
   | `postgres` | *(ninguno — no exponer)* |

5. **Environment Variables** en Coolify:

   | Variable | Valor |
   |---|---|
   | `POSTGRES_PASSWORD` | contraseña segura (obligatoria, URL-safe) |
   | `POSTGRES_USER` | `modaflow` (opcional) |
   | `POSTGRES_DB` | `modaflow` (opcional) |
   | `APP_DB_PASSWORD` | contraseña del usuario `modaflow_app` (obligatoria, URL-safe, distinta de las otras) |
   | `ADMIN_DB_PASSWORD` | contraseña del usuario `modaflow_admin` (obligatoria, URL-safe, distinta de las otras) |
   | `ADMIN_WEB_URL` | `https://admin.modaflow.amicornios.com` |
   | `SETTINGS_ENCRYPTION_KEY` | 64 caracteres hex (obligatoria; ya generada en `.env.coolify`). No cambiarla una vez en uso |
   | `SMTP_*` | opcionales: valores por defecto del correo (también se configuran desde el panel) |
   | `NEXT_PUBLIC_API_URL` | `https://api.modaflow.amicornios.com` (se usa como build arg de `web`) |
   | `CORS_ORIGINS` | `https://modaflow.amicornios.com` |
   | `SWAGGER_ENABLED` | `false` (o `true` si quieres Swagger público) |
   | `ANTHROPIC_API_KEY` | clave de la API de Claude (secreta). Opcional si se configura desde el panel admin |
   | `ANTHROPIC_MODEL` | `claude-opus-5-5` (o el modelo que elijas) |
   | `S3_ENDPOINT` | endpoint del proveedor S3 (vacío = AWS S3) |
   | `S3_REGION` | región (`auto` en Cloudflare R2) |
   | `S3_BUCKET` | bucket **privado** de fotos |
   | `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | credenciales con permisos de lectura, escritura y borrado en el bucket (secretas) |
   | `S3_FORCE_PATH_STYLE` | vacío = automático: bucket en el dominio (Hetzner, AWS); formato path solo para endpoints locales (localhost, IP, nombre de servicio Docker). `true`/`false` lo fuerza |
   | `S3_PUBLIC_URLS` | `true` si el bucket es público: las imágenes usan URLs directas y cortas; los comprobantes de pago siguen firmados. También se configura desde el panel |
   | `S3_KEY_PREFIX` | carpeta dentro del bucket (por ejemplo `modaflow`); vacío = raíz. Cambiarla exige mover los archivos ya subidos |

   **Almacenamiento S3 en producción** (elige uno y crea el bucket, que debe ser privado):
   - **Cloudflare R2**: `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, `S3_REGION=auto`.
   - **AWS S3**: deja `S3_ENDPOINT` vacío e indica la región del bucket.
   - **Autoalojado en Coolify** (MinIO/SeaweedFS como servicio aparte): usa su URL pública con HTTPS como
     `S3_ENDPOINT`. El navegador abre las URLs firmadas en ese mismo host, así que debe ser accesible desde internet.

   Si cambias `NEXT_PUBLIC_API_URL`, haz **redeploy** (el valor se incrusta al construir).
6. DNS y certificados: se configuran después desde Coolify (registros A de los tres dominios —web, api y admin—
   hacia el servidor; Coolify emite los certificados al asignar los dominios).
7. **Después del primer despliegue**: invita al primer superadministrador desde la terminal del servicio
   `admin-api` (`node dist/cli/staff.js invite ...`, ver la sección de sistemas separados) y abre el enlace.
   Opcional: restringe `admin.modaflow.amicornios.com` por IP o VPN desde el proxy de Coolify.
8. El servicio `migrate` termina después de cada despliegue (estado *exited*, código 0). Es lo esperado: no lo
   reinicies ni le asignes dominio.

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
| Dominio `admin-web` | `https://admin.staging.modaflow.amicornios.com:3000` |
| Dominio `admin-api`, `migrate`, `postgres` | *(ninguno)* |

Variables de entorno de staging (distintas de producción, **otra contraseña**):

| Variable | Valor |
|---|---|
| `POSTGRES_PASSWORD` | contraseña propia de staging (obligatoria) |
| `APP_DB_PASSWORD` / `ADMIN_DB_PASSWORD` | contraseñas propias de staging (obligatorias, distintas de producción) |
| `ADMIN_WEB_URL` | `https://admin.staging.modaflow.amicornios.com` |
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
| @anthropic-ai/sdk (Etapa 2) | 1.8.0 |
| @aws-sdk/client-s3 + s3-request-presigner (Etapa 2) | 3.1169.0 |
| sharp (Etapa 2) | 0.35.5 |
| pdfkit (Etapa 3) | 0.20.2 |
| exceljs (Etapa 4; `uuid` forzado a 11.1.1 por `overrides`) | 4.4.0 |
| recharts (Etapa 4) | 3.10.1 |
| qrcode (Etapa 5) | 1.5.4 |
| @nestjs/schedule (Etapa 6) | 12.0.2 |
| zod (web y api) | 4.6.7 |
| @nestjs/throttler / @node-rs/argon2 (Etapa 1) | 6.7.1 / 2.2.2 |
| SeaweedFS (S3 local, solo desarrollo) | 4.53 |
| PostgreSQL | 18 (alpine) |
