-- Stage 4: reports. Adds the store time zone, per-line historical cost, the
-- line's net amount after the general discount and a category snapshot.
-- Non-destructive: only new columns, a backfill derived from stored sale data
-- and new indexes/constraints.

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "timezone" VARCHAR(64) NOT NULL DEFAULT 'America/La_Paz';

-- AlterTable (net_total is filled below before becoming NOT NULL)
ALTER TABLE "sale_items" ADD COLUMN     "category_id" UUID,
ADD COLUMN     "category_name" VARCHAR(60),
ADD COLUMN     "net_total" DECIMAL(12,2),
ADD COLUMN     "unit_cost" DECIMAL(12,2);

-- Backfill net_total from the stored sale amounts (verifiable): each line gets
-- floor(discount * line / lines_total) cents of the general discount and the
-- leftover cents go one by one to the first lines by position. This is the
-- same rule the API applies to new sales (allocateGeneralDiscount).
WITH lines AS (
  SELECT si.id,
         si.sale_id,
         si.position,
         ROUND(si.line_total * 100)::bigint AS line_cents,
         ROUND(s.discount_amount * 100)::bigint AS discount_cents,
         SUM(ROUND(si.line_total * 100)::bigint) OVER (PARTITION BY si.sale_id) AS lines_cents
  FROM sale_items si
  JOIN sales s ON s.id = si.sale_id
),
shares AS (
  SELECT id, sale_id, position, line_cents, discount_cents,
         CASE WHEN lines_cents = 0 THEN 0 ELSE (discount_cents * line_cents) / lines_cents END AS share
  FROM lines
),
ranked AS (
  SELECT id, line_cents, share,
         discount_cents - SUM(share) OVER (PARTITION BY sale_id) AS leftover,
         ROW_NUMBER() OVER (PARTITION BY sale_id ORDER BY position) AS rn
  FROM shares
)
UPDATE sale_items si
SET net_total = (r.line_cents - r.share - CASE WHEN r.rn <= r.leftover THEN 1 ELSE 0 END)::numeric / 100
FROM ranked r
WHERE r.id = si.id;

ALTER TABLE "sale_items" ALTER COLUMN "net_total" SET NOT NULL;

-- Category snapshot for existing lines: taken from the product's current
-- category (descriptive data only). Historical costs are NOT backfilled:
-- there is no record of the purchase price at the time of those sales, so
-- they stay NULL and reports show them as "sin costo registrado".
UPDATE sale_items si
SET category_id = c.id, category_name = c.name
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE p.id = si.product_id;

ALTER TABLE "sale_items"
  ADD CONSTRAINT "sale_items_net_total_valid" CHECK (net_total >= 0 AND net_total <= line_total),
  ADD CONSTRAINT "sale_items_unit_cost_valid" CHECK (unit_cost IS NULL OR unit_cost >= 0);

-- CreateIndex
CREATE INDEX "inventory_movements_tenant_id_type_created_at_idx" ON "inventory_movements"("tenant_id", "type", "created_at");

-- CreateIndex
CREATE INDEX "sale_items_tenant_id_category_id_idx" ON "sale_items"("tenant_id", "category_id");
