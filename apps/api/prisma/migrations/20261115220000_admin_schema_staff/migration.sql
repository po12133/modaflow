-- Separates ModaFlow staff from subscriber accounts.
-- Runs in one transaction: either everything applies or nothing does.
BEGIN;

-- Schema and staff identity -------------------------------------------------
CREATE SCHEMA IF NOT EXISTS "admin";

CREATE TYPE "admin"."StaffRole" AS ENUM ('SUPERADMIN', 'SUPPORT');
CREATE TYPE "admin"."StaffStatus" AS ENUM ('ACTIVE', 'DISABLED');

CREATE TABLE "admin"."staff" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" TEXT,
    "role" "admin"."StaffRole" NOT NULL,
    "status" "admin"."StaffStatus" NOT NULL DEFAULT 'ACTIVE',
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "staff_email_lowercase" CHECK ("email" = lower(btrim("email"))),
    CONSTRAINT "staff_failed_attempts_valid" CHECK ("failed_login_attempts" >= 0)
);

CREATE TABLE "admin"."staff_sessions" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(512),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "last_used_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin"."staff_setup_tokens" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_setup_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "staff_email_key" ON "admin"."staff"("email");
CREATE UNIQUE INDEX "staff_sessions_token_hash_key" ON "admin"."staff_sessions"("token_hash");
CREATE INDEX "staff_sessions_staff_id_idx" ON "admin"."staff_sessions"("staff_id");
CREATE INDEX "staff_sessions_expires_at_idx" ON "admin"."staff_sessions"("expires_at");
CREATE UNIQUE INDEX "staff_setup_tokens_token_hash_key" ON "admin"."staff_setup_tokens"("token_hash");
CREATE INDEX "staff_setup_tokens_staff_id_idx" ON "admin"."staff_setup_tokens"("staff_id");

ALTER TABLE "admin"."staff_sessions" ADD CONSTRAINT "staff_sessions_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "admin"."staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin"."staff_setup_tokens" ADD CONSTRAINT "staff_setup_tokens_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "admin"."staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing administrators become staff with the same id (so audit and
-- financial records keep their author). Former role holders that appear as
-- authors are kept as DISABLED staff.
INSERT INTO "admin"."staff" ("id", "name", "email", "password_hash", "role", "status", "last_login_at", "created_at", "updated_at")
SELECT u."id", u."name", u."email", u."password_hash",
       COALESCE(u."global_role"::text, 'SUPPORT')::"admin"."StaffRole",
       (CASE WHEN u."global_role" IS NOT NULL AND u."status" = 'ACTIVE' THEN 'ACTIVE' ELSE 'DISABLED' END)::"admin"."StaffStatus",
       u."last_login_at", u."created_at", CURRENT_TIMESTAMP
FROM "users" u
WHERE u."global_role" IS NOT NULL
   OR u."id" IN (
        SELECT "actor_id" FROM "admin_audit_logs"
        UNION SELECT "reviewed_by_id" FROM "plan_change_requests" WHERE "reviewed_by_id" IS NOT NULL
        UNION SELECT "created_by_id" FROM "plan_versions" WHERE "created_by_id" IS NOT NULL
        UNION SELECT "created_by_id" FROM "subscription_periods" WHERE "created_by_id" IS NOT NULL
        UNION SELECT "updated_by_id" FROM "platform_settings" WHERE "updated_by_id" IS NOT NULL
        UNION SELECT "actor_id" FROM "subscription_history" WHERE "actor_id" IS NOT NULL AND "action" <> 'TRIAL_STARTED'
      );

-- Staff authorship ----------------------------------------------------------
ALTER TABLE "plan_change_requests" DROP CONSTRAINT "plan_change_requests_reviewed_by_id_fkey";
ALTER TABLE "plan_change_requests" ADD CONSTRAINT "plan_change_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "admin"."staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "plan_versions" DROP CONSTRAINT "plan_versions_created_by_id_fkey";
ALTER TABLE "plan_versions" ADD CONSTRAINT "plan_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "admin"."staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "subscription_periods" DROP CONSTRAINT "subscription_periods_created_by_id_fkey";
ALTER TABLE "subscription_periods" ADD CONSTRAINT "subscription_periods_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "admin"."staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "admin"."staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "subscription_history" ADD COLUMN "actor_staff_id" UUID;
UPDATE "subscription_history" SET "actor_staff_id" = "actor_id", "actor_id" = NULL
WHERE "actor_id" IS NOT NULL AND "action" <> 'TRIAL_STARTED';
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_actor_staff_id_fkey" FOREIGN KEY ("actor_staff_id") REFERENCES "admin"."staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_single_actor" CHECK ("actor_id" IS NULL OR "actor_staff_id" IS NULL);

-- Audit log moves to the admin schema, keeping every row and its trigger ----
ALTER TABLE "admin_audit_logs" DROP CONSTRAINT "admin_audit_logs_actor_id_fkey";
ALTER TABLE "admin_audit_logs" SET SCHEMA "admin";
ALTER TABLE "admin"."admin_audit_logs" RENAME TO "audit_logs";
ALTER TABLE "admin"."audit_logs" RENAME CONSTRAINT "admin_audit_logs_pkey" TO "audit_logs_pkey";
ALTER INDEX "admin"."admin_audit_logs_created_at_idx" RENAME TO "audit_logs_created_at_idx";
ALTER INDEX "admin"."admin_audit_logs_entity_type_entity_id_idx" RENAME TO "audit_logs_entity_type_entity_id_idx";
ALTER INDEX "admin"."admin_audit_logs_actor_id_created_at_idx" RENAME TO "audit_logs_actor_id_created_at_idx";
ALTER TABLE "admin"."audit_logs" ALTER COLUMN "actor_id" DROP NOT NULL;
ALTER TABLE "admin"."audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "admin"."staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER FUNCTION "public"."admin_audit_logs_immutable"() SET SCHEMA "admin";
ALTER FUNCTION "admin"."admin_audit_logs_immutable"() RENAME TO "audit_logs_immutable";
ALTER TRIGGER "admin_audit_logs_no_update" ON "admin"."audit_logs" RENAME TO "audit_logs_append_only";

-- Subscriber accounts no longer carry platform roles -------------------------
ALTER TABLE "users" DROP COLUMN "global_role";
DROP TYPE "GlobalRole";

-- Database roles --------------------------------------------------------------
-- Created without login. Passwords are set at deploy time from environment
-- variables (APP_DB_PASSWORD / ADMIN_DB_PASSWORD), never stored here.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'modaflow_app') THEN
    CREATE ROLE "modaflow_app" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'modaflow_admin') THEN
    CREATE ROLE "modaflow_admin" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO "modaflow_app", "modaflow_admin"', current_database());
END $$;

-- Subscriber API: its own data. It can create a subscription (onboarding) and
-- lock it, but never change its plan, status or dates; it cannot see the
-- admin schema and financial history is append-only.
GRANT USAGE ON SCHEMA "public" TO "modaflow_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "public" TO "modaflow_app";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "public" TO "modaflow_app";
REVOKE ALL ON "public"."_prisma_migrations" FROM "modaflow_app";
REVOKE UPDATE, DELETE ON "subscriptions" FROM "modaflow_app";
GRANT UPDATE ("updated_at") ON "subscriptions" TO "modaflow_app";
REVOKE UPDATE, DELETE ON "subscription_periods", "subscription_history" FROM "modaflow_app";
REVOKE INSERT, UPDATE, DELETE ON "plans", "plan_versions", "platform_settings" FROM "modaflow_app";
REVOKE UPDATE, DELETE ON "plan_change_requests" FROM "modaflow_app";
GRANT UPDATE ("receipt_key", "receipt_uploaded_at", "submitted_at", "status", "updated_at") ON "plan_change_requests" TO "modaflow_app";
ALTER DEFAULT PRIVILEGES IN SCHEMA "public" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "modaflow_app";
ALTER DEFAULT PRIVILEGES IN SCHEMA "public" GRANT USAGE, SELECT ON SEQUENCES TO "modaflow_app";

-- Admin API: staff schema (audit is insert-only) and only the operations the
-- panel needs on subscriber data. It cannot read password hashes or session
-- tokens, and cannot delete business or financial records.
GRANT USAGE ON SCHEMA "admin" TO "modaflow_admin";
GRANT SELECT, INSERT, UPDATE ON "admin"."staff" TO "modaflow_admin";
GRANT SELECT, INSERT, UPDATE, DELETE ON "admin"."staff_sessions", "admin"."staff_setup_tokens" TO "modaflow_admin";
GRANT SELECT, INSERT ON "admin"."audit_logs" TO "modaflow_admin";

GRANT USAGE ON SCHEMA "public" TO "modaflow_admin";
GRANT SELECT ON ALL TABLES IN SCHEMA "public" TO "modaflow_admin";
REVOKE ALL ON "public"."_prisma_migrations", "users", "sessions", "password_reset_tokens" FROM "modaflow_admin";
GRANT SELECT ("id", "name", "email", "failed_login_attempts", "locked_until", "last_login_at", "status", "suspended_at", "suspended_reason", "created_at", "updated_at") ON "users" TO "modaflow_admin";
GRANT UPDATE ("status", "suspended_at", "suspended_reason", "updated_at") ON "users" TO "modaflow_admin";
GRANT SELECT ("id", "user_id", "expires_at", "last_used_at", "created_at") ON "sessions" TO "modaflow_admin";
GRANT DELETE ON "sessions" TO "modaflow_admin";
GRANT UPDATE ON "subscriptions", "plans", "platform_settings" TO "modaflow_admin";
GRANT INSERT ON "subscription_periods", "subscription_history", "plan_versions", "notifications" TO "modaflow_admin";
GRANT INSERT, UPDATE ON "plan_change_requests" TO "modaflow_admin";
GRANT UPDATE ("read_at", "email_status") ON "notifications" TO "modaflow_admin";

COMMIT;
