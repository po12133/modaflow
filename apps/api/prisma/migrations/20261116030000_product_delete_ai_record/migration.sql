BEGIN;

ALTER TYPE "ProductStatus" RENAME VALUE 'ARCHIVED' TO 'DELETED';
ALTER TABLE "products" RENAME COLUMN "archived_at" TO "deleted_at";
ALTER TABLE "products" ADD COLUMN "deleted_by_id" UUID;
ALTER TABLE "products" ADD CONSTRAINT "products_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Deleted products release their code and catalog link so the store can reuse them.
UPDATE "products"
SET "sku" = left("sku", 30) || '~' || left("id"::text, 8),
    "slug" = left("slug", 120) || '-borrado-' || left("id"::text, 8),
    "catalog_published" = false
WHERE "status" = 'DELETED';

ALTER TABLE "product_images" ADD COLUMN "ai_scanned" BOOLEAN NOT NULL DEFAULT false;
UPDATE "product_images" SET "ai_scanned" = true
WHERE "id"::text IN (SELECT unnest("image_ids") FROM "ai_analyses");

COMMIT;
