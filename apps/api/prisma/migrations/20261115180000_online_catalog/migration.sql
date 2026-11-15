-- CreateEnum
CREATE TYPE "CatalogStatus" AS ENUM ('PUBLISHED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "OutOfStockMode" AS ENUM ('SHOW', 'HIDE');

-- CreateEnum
CREATE TYPE "CatalogRequestStatus" AS ENUM ('CREATED', 'WHATSAPP_OPENED', 'ATTENDED', 'CANCELED');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "catalog_published" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slug" VARCHAR(140);

-- Public slug for existing products, same rule as productSlug(name, sku) in the API.
CREATE FUNCTION pg_temp.mf_slugify(value text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(both '-' FROM regexp_replace(
    lower(translate(value, 'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ', 'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC')),
    '[^a-z0-9]+', '-', 'g'))
$$;

UPDATE "products"
SET "slug" = coalesce(nullif(rtrim(left(pg_temp.mf_slugify("name"), 100), '-'), ''), 'prenda') || '-' || coalesce(nullif(pg_temp.mf_slugify("sku"), ''), left(replace("id"::text, '-', ''), 8));

ALTER TABLE "products" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "products" ADD CONSTRAINT "products_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- CreateTable
CREATE TABLE "catalog_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "status" "CatalogStatus" NOT NULL DEFAULT 'PUBLISHED',
    "secondary_color" CHAR(7) NOT NULL DEFAULT '#FF5C8A',
    "logo_key" VARCHAR(300),
    "cover_key" VARCHAR(300),
    "welcome_message" VARCHAR(300),
    "out_of_stock" "OutOfStockMode" NOT NULL DEFAULT 'SHOW',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "catalog_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_order_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "status" "CatalogRequestStatus" NOT NULL DEFAULT 'CREATED',
    "item_count" INTEGER NOT NULL,
    "unit_count" INTEGER NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "whatsapp_opened_at" TIMESTAMPTZ(3),
    "status_changed_at" TIMESTAMPTZ(3),
    "sale_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "catalog_order_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_order_request_items" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "product_name" VARCHAR(120) NOT NULL,
    "sku" VARCHAR(48) NOT NULL,
    "size" VARCHAR(20),
    "color" VARCHAR(40),
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "line_total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "catalog_order_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "catalog_settings_store_id_key" ON "catalog_settings"("store_id");

-- CreateIndex
CREATE INDEX "catalog_settings_tenant_id_idx" ON "catalog_settings"("tenant_id");

-- CreateIndex
CREATE INDEX "catalog_order_requests_tenant_id_created_at_idx" ON "catalog_order_requests"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "catalog_order_requests_tenant_id_status_created_at_idx" ON "catalog_order_requests"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "catalog_order_requests_sale_id_idx" ON "catalog_order_requests"("sale_id");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_order_requests_tenant_id_code_key" ON "catalog_order_requests"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "catalog_order_request_items_request_id_idx" ON "catalog_order_request_items"("request_id");

-- CreateIndex
CREATE INDEX "catalog_order_request_items_tenant_id_product_id_idx" ON "catalog_order_request_items"("tenant_id", "product_id");

-- CreateIndex
CREATE INDEX "products_tenant_id_catalog_published_status_created_at_idx" ON "products"("tenant_id", "catalog_published", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "products_tenant_id_slug_key" ON "products"("tenant_id", "slug");

-- AddForeignKey
ALTER TABLE "catalog_settings" ADD CONSTRAINT "catalog_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_settings" ADD CONSTRAINT "catalog_settings_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_order_requests" ADD CONSTRAINT "catalog_order_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_order_requests" ADD CONSTRAINT "catalog_order_requests_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_order_requests" ADD CONSTRAINT "catalog_order_requests_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_order_request_items" ADD CONSTRAINT "catalog_order_request_items_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "catalog_order_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_order_request_items" ADD CONSTRAINT "catalog_order_request_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_order_request_items" ADD CONSTRAINT "catalog_order_request_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_order_request_items" ADD CONSTRAINT "catalog_order_request_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Integrity rules
ALTER TABLE "catalog_settings"
  ADD CONSTRAINT "catalog_settings_secondary_color_hex" CHECK ("secondary_color" ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE "catalog_order_requests"
  ADD CONSTRAINT "catalog_order_requests_amounts_valid" CHECK ("total" >= 0 AND "item_count" > 0 AND "unit_count" >= "item_count"),
  ADD CONSTRAINT "catalog_order_requests_opened_consistent" CHECK ("status" <> 'WHATSAPP_OPENED' OR "whatsapp_opened_at" IS NOT NULL);

ALTER TABLE "catalog_order_request_items"
  ADD CONSTRAINT "catalog_order_request_items_amounts_valid" CHECK ("quantity" > 0 AND "unit_price" >= 0 AND "line_total" = "unit_price" * "quantity");
