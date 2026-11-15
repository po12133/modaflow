-- Integrations (S3, Claude, SMTP) editable from the admin panel.
BEGIN;

CREATE TABLE "integration_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "s3_endpoint" VARCHAR(300),
    "s3_public_endpoint" VARCHAR(300),
    "s3_region" VARCHAR(40),
    "s3_bucket" VARCHAR(80),
    "s3_force_path_style" BOOLEAN,
    "s3_access_key_id_enc" TEXT,
    "s3_access_key_id_hint" VARCHAR(8),
    "s3_secret_access_key_enc" TEXT,
    "s3_secret_access_key_hint" VARCHAR(8),
    "anthropic_api_key_enc" TEXT,
    "anthropic_api_key_hint" VARCHAR(8),
    "anthropic_model" VARCHAR(80),
    "smtp_host" VARCHAR(200),
    "smtp_port" INTEGER,
    "smtp_secure" BOOLEAN,
    "smtp_user" VARCHAR(200),
    "smtp_password_enc" TEXT,
    "smtp_password_hint" VARCHAR(8),
    "smtp_from_email" VARCHAR(254),
    "smtp_from_name" VARCHAR(80),
    "updated_by_id" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "integration_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "integration_settings_singleton" CHECK ("id" = 1),
    CONSTRAINT "integration_settings_smtp_port_valid" CHECK ("smtp_port" IS NULL OR "smtp_port" BETWEEN 1 AND 65535)
);

ALTER TABLE "integration_settings" ADD CONSTRAINT "integration_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "admin"."staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "integration_settings" ("id", "updated_at") VALUES (1, CURRENT_TIMESTAMP);

-- Subscriber API reads the (encrypted) values; only the admin API changes them.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON "integration_settings" FROM "modaflow_app";
GRANT SELECT ON "integration_settings" TO "modaflow_app";
GRANT SELECT, UPDATE ON "integration_settings" TO "modaflow_admin";

COMMIT;
