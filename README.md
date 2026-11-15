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

## Arquitectura (Etapa 2: registro de prendas con IA e inventario)

**Productos y variantes**
- `Product` (modelo de prenda: precios en `Decimal(12,2)`, categoría, etiquetas, fotos) y `ProductVariant`
  (talla/color con su propio **stock** y SKU). Una prenda única o de fardo es una sola variante sin talla.
- SKU automático por tienda (`P00001`, variantes `P00001-M-ROJO`) y editable.
- **Límite del plan**: cuentan solo los productos **activos**; cada producto cuenta una vez sin importar sus
  variantes o unidades. Archivar libera el cupo y restaurar vuelve a comprobarlo. Las ediciones están permitidas
  aunque se alcance el límite, siempre que la suscripción esté activa. La comprobación bloquea la fila de la
  suscripción (`FOR UPDATE`), así que dos registros simultáneos no pueden superar el máximo.
- Archivar es un borrado lógico (`DELETE /products/:id`): nunca se elimina un producto con historial.

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
- `POST /ai/analyze-garment` (1 a 4 fotos) envía las fotos optimizadas a Claude, con salida estructurada validada
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

**Catálogo público** en `/tienda/{slug}` (sin registro): portada, logotipo, descripción, ciudad, botón de WhatsApp,
búsqueda (nombre, categoría, color, talla, etiquetas), filtros (categoría, talla, color, rango de precio,
disponibilidad), orden (recientes, precio, nombre) y paginación en el backend (24 por página). Detalle en
`/tienda/{slug}/producto/{productSlug}` con galería (miniaturas y vista ampliada), variantes disponibles y cantidad
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
`/tienda/{slug}/imagen` y `/producto/{slug}/imagen` que redirige a la foto firmada), `sitemap.xml` dinámico solo con
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

En las pruebas de créditos, el modelo de visión se reemplaza por un **doble de prueba**: se prueba la lógica real de
créditos y no se simula a Claude. La llamada real a Claude tiene su propia prueba, que solo se ejecuta con clave:

```bash
ANTHROPIC_API_KEY=sk-ant-... AI_TEST_IMAGE=/ruta/a/foto-de-prenda.jpg npm run test:e2e
```

Componentes de shadcn/ui: `cd apps/web && npx shadcn@latest add <componente>`.

## Prisma

- Configuración: [apps/api/prisma7.config.ts](apps/api/prisma7.config.ts) (nombre de archivo propio de Prisma 7.10) y
  [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma).
- Modelos: `User`, `Session`, `PasswordResetToken`, `Tenant`, `TenantMembership`, `Store`, `Plan`, `Subscription`,
  `SubscriptionUsage`, `TrialGrant` y `PlanChangeRequest` (Etapa 1); `Category`, `Tag`, `ProductTag`, `Product`,
  `ProductVariant`, `ProductImage`, `InventoryMovement` y `AiAnalysis` (Etapa 2); `Sale`, `SaleItem` y
  `SaleCancellation` (Etapa 3); costos históricos, total neto y categoría en `SaleItem` y zona horaria en `Store`
  (Etapa 4); `CatalogSettings`, `CatalogOrderRequest`, `CatalogOrderRequestItem`, y `slug`/`catalogPublished` en
  `Product` (Etapa 5). Todos con claves foráneas,
  índices (incluidos índices trigram `pg_trgm` para la búsqueda) y restricciones `CHECK`.
- Migraciones: `20261115015333_init_tenancy_and_subscriptions`, `20261115030329_catalog_inventory_ai`,
  `20261115040424_sale_movement_types`, `20261115040539_sales_pos_receipts`, `20261115120000_reports_costs_timezone` y `20261115180000_online_catalog` (rellena
  el slug de los productos existentes). Desde la segunda solo agregan tablas,
  valores de enum, columnas con valor por defecto o nulas (`tenants.product_seq`, `tenants.sale_seq`,
  `inventory_movements.sale_id`) y restricciones, sin cambios destructivos. Los valores nuevos del enum de
  movimientos van en una migración aparte porque PostgreSQL no permite usarlos en la misma transacción que los crea.
- No se usa `prisma db push`: los cambios de esquema van siempre como migraciones versionadas.
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
   | `ANTHROPIC_API_KEY` | clave de la API de Claude (secreta). Sin ella, la IA queda deshabilitada |
   | `ANTHROPIC_MODEL` | `claude-opus-5-5` (o el modelo que elijas) |
   | `S3_ENDPOINT` | endpoint del proveedor S3 (vacío = AWS S3) |
   | `S3_REGION` | región (`auto` en Cloudflare R2) |
   | `S3_BUCKET` | bucket **privado** de fotos |
   | `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | credenciales con permisos de lectura, escritura y borrado en el bucket (secretas) |
   | `S3_FORCE_PATH_STYLE` | `true` para MinIO/SeaweedFS/R2; `false` es válido para AWS S3 |

   **Almacenamiento S3 en producción** (elige uno y crea el bucket, que debe ser privado):
   - **Cloudflare R2**: `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, `S3_REGION=auto`.
   - **AWS S3**: deja `S3_ENDPOINT` vacío e indica la región del bucket.
   - **Autoalojado en Coolify** (MinIO/SeaweedFS como servicio aparte): usa su URL pública con HTTPS como
     `S3_ENDPOINT`. El navegador abre las URLs firmadas en ese mismo host, así que debe ser accesible desde internet.

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
| @anthropic-ai/sdk (Etapa 2) | 1.8.0 |
| @aws-sdk/client-s3 + s3-request-presigner (Etapa 2) | 3.1169.0 |
| sharp (Etapa 2) | 0.35.5 |
| pdfkit (Etapa 3) | 0.20.2 |
| exceljs (Etapa 4; `uuid` forzado a 11.1.1 por `overrides`) | 4.4.0 |
| recharts (Etapa 4) | 3.10.1 |
| qrcode (Etapa 5) | 1.5.4 |
| zod (web y api) | 4.6.7 |
| @nestjs/throttler / @node-rs/argon2 (Etapa 1) | 6.7.1 / 2.2.2 |
| SeaweedFS (S3 local, solo desarrollo) | 4.53 |
| PostgreSQL | 18 (alpine) |
