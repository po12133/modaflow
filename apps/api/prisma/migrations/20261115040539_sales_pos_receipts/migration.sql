-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'QR', 'TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'AMOUNT');

-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN     "sale_id" UUID;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "sale_seq" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "sales" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "seller_id" UUID NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "items_discount" DECIMAL(12,2) NOT NULL,
    "discount_type" "DiscountType",
    "discount_value" DECIMAL(12,2),
    "discount_amount" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "unit_count" INTEGER NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "payment_confirmed" BOOLEAN NOT NULL,
    "amount_received" DECIMAL(12,2),
    "change_given" DECIMAL(12,2),
    "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED',
    "idempotency_key" VARCHAR(64) NOT NULL,
    "receipt_token" VARCHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "canceled_at" TIMESTAMPTZ(3),

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
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
    "discount_type" "DiscountType",
    "discount_value" DECIMAL(12,2),
    "unit_discount" DECIMAL(12,2) NOT NULL,
    "final_unit_price" DECIMAL(12,2) NOT NULL,
    "line_total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_cancellations" (
    "id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reason" VARCHAR(200) NOT NULL,
    "notes" VARCHAR(500),
    "restocked_units" INTEGER NOT NULL,
    "idempotency_key" VARCHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_cancellations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_receipt_token_key" ON "sales"("receipt_token");

-- CreateIndex
CREATE INDEX "sales_tenant_id_created_at_idx" ON "sales"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "sales_tenant_id_status_created_at_idx" ON "sales"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "sales_tenant_id_payment_method_created_at_idx" ON "sales"("tenant_id", "payment_method", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sales_tenant_id_number_key" ON "sales"("tenant_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "sales_tenant_id_idempotency_key_key" ON "sales"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "sale_items_sale_id_idx" ON "sale_items"("sale_id");

-- CreateIndex
CREATE INDEX "sale_items_tenant_id_product_id_idx" ON "sale_items"("tenant_id", "product_id");

-- CreateIndex
CREATE INDEX "sale_items_variant_id_idx" ON "sale_items"("variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "sale_cancellations_sale_id_key" ON "sale_cancellations"("sale_id");

-- CreateIndex
CREATE INDEX "sale_cancellations_tenant_id_created_at_idx" ON "sale_cancellations"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_movements_sale_id_idx" ON "inventory_movements"("sale_id");

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_cancellations" ADD CONSTRAINT "sale_cancellations_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_cancellations" ADD CONSTRAINT "sale_cancellations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Custom constraints (not expressible in the Prisma schema)
-- ---------------------------------------------------------------------------

-- Movement ledger: SALE_CANCEL restores stock (increase); SALE decreases it.
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_balance";
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_balance" CHECK (
  CASE
    WHEN "type" IN ('INITIAL', 'STOCK_IN', 'ADJUSTMENT_IN', 'SALE_CANCEL') THEN "stock_after" = "stock_before" + "quantity"
    ELSE "stock_after" = "stock_before" - "quantity"
  END
);
-- Sale movements are always linked to their sale, and only those.
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_sale_link"
  CHECK (("type" IN ('SALE', 'SALE_CANCEL')) = ("sale_id" IS NOT NULL));

ALTER TABLE "tenants" ADD CONSTRAINT "tenants_sale_seq_non_negative" CHECK ("sale_seq" >= 0);

-- Sale amounts: never negative and always consistent.
ALTER TABLE "sales" ADD CONSTRAINT "sales_number_positive" CHECK ("number" > 0);
ALTER TABLE "sales" ADD CONSTRAINT "sales_unit_count_positive" CHECK ("unit_count" > 0);
ALTER TABLE "sales" ADD CONSTRAINT "sales_amounts_non_negative" CHECK (
  "subtotal" >= 0 AND "items_discount" >= 0 AND "discount_amount" >= 0 AND "total" >= 0
  AND ("discount_value" IS NULL OR "discount_value" >= 0)
  AND ("amount_received" IS NULL OR "amount_received" >= 0)
  AND ("change_given" IS NULL OR "change_given" >= 0)
);
ALTER TABLE "sales" ADD CONSTRAINT "sales_total_consistent"
  CHECK ("total" = "subtotal" - "items_discount" - "discount_amount");
ALTER TABLE "sales" ADD CONSTRAINT "sales_cancel_consistent"
  CHECK (("status" = 'CANCELED') = ("canceled_at" IS NOT NULL));
ALTER TABLE "sales" ADD CONSTRAINT "sales_payment_confirmed" CHECK ("payment_confirmed");

-- Sale lines: positive quantity, per-unit discount within the price, consistent totals.
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_amounts_valid" CHECK (
  "unit_price" >= 0 AND "unit_discount" >= 0 AND "unit_discount" <= "unit_price"
  AND "final_unit_price" = "unit_price" - "unit_discount"
  AND "line_total" = "final_unit_price" * "quantity"
  AND ("discount_value" IS NULL OR "discount_value" >= 0)
);

ALTER TABLE "sale_cancellations" ADD CONSTRAINT "sale_cancellations_restocked_non_negative" CHECK ("restocked_units" >= 0);
