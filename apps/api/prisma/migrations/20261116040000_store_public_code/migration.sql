ALTER TABLE "stores" ADD COLUMN "public_code" VARCHAR(20);

UPDATE "stores" SET "public_code" = 'modaflow-' || substr(md5(random()::text || "id"::text), 1, 7);

ALTER TABLE "stores" ALTER COLUMN "public_code" SET NOT NULL;

CREATE UNIQUE INDEX "stores_public_code_key" ON "stores"("public_code");
