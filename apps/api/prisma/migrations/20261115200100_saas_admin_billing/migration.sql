-- CreateEnum
CREATE TYPE "GlobalRole" AS ENUM ('SUPERADMIN', 'SUPPORT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PlatformPaymentMethod" AS ENUM ('QR', 'TRANSFER');

-- CreateEnum
CREATE TYPE "PeriodKind" AS ENUM ('TRIAL', 'ACTIVATION', 'RENEWAL', 'PLAN_CHANGE', 'EXTENSION');

-- CreateEnum
CREATE TYPE "SubscriptionAction" AS ENUM ('TRIAL_STARTED', 'TRIAL_EXTENDED', 'ACTIVATED', 'RENEWED', 'PLAN_CHANGED', 'SUSPENDED', 'REACTIVATED', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AuditResult" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateEnum
CREATE TYPE "NotificationAudience" AS ENUM ('TENANT', 'ADMIN');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('TRIAL_ENDING', 'TRIAL_EXPIRED', 'PAYMENT_SUBMITTED', 'PAYMENT_APPROVED', 'PAYMENT_REJECTED', 'SUBSCRIPTION_ACTIVATED', 'SUBSCRIPTION_ENDING', 'SUBSCRIPTION_EXPIRED');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING', 'SENT', 'SKIPPED', 'FAILED');

-- AlterTable
ALTER TABLE "plan_change_requests" ADD COLUMN     "amount_confirmed" DECIMAL(12,2),
ADD COLUMN     "amount_expected" DECIMAL(12,2),
ADD COLUMN     "method" "PlatformPaymentMethod",
ADD COLUMN     "plan_version_id" UUID,
ADD COLUMN     "receipt_key" VARCHAR(300),
ADD COLUMN     "receipt_uploaded_at" TIMESTAMPTZ(3),
ADD COLUMN     "review_note" VARCHAR(500),
ADD COLUMN     "reviewed_at" TIMESTAMPTZ(3),
ADD COLUMN     "reviewed_by_id" UUID,
ADD COLUMN     "submitted_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "plan_version_id" UUID,
ADD COLUMN     "suspended_at" TIMESTAMPTZ(3),
ADD COLUMN     "suspended_from" "SubscriptionStatus";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "global_role" "GlobalRole",
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "suspended_at" TIMESTAMPTZ(3),
ADD COLUMN     "suspended_reason" VARCHAR(300);

-- CreateTable
CREATE TABLE "plan_versions" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "billing_period" "BillingPeriod" NOT NULL,
    "duration_days" INTEGER,
    "max_products" INTEGER NOT NULL,
    "ai_analyses_limit" INTEGER NOT NULL,
    "ai_analyses_period" "UsagePeriod" NOT NULL,
    "max_users" INTEGER NOT NULL,
    "max_branches" INTEGER NOT NULL,
    "inventory_and_sales" BOOLEAN NOT NULL,
    "advanced_reports" BOOLEAN NOT NULL,
    "online_catalog" "CatalogAccess" NOT NULL,
    "advanced_management" BOOLEAN NOT NULL,
    "is_trial" BOOLEAN NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_periods" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "plan_version_id" UUID,
    "kind" "PeriodKind" NOT NULL,
    "period_start" TIMESTAMPTZ(3) NOT NULL,
    "period_end" TIMESTAMPTZ(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_request_id" UUID,
    "created_by_id" UUID,
    "note" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_history" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "action" "SubscriptionAction" NOT NULL,
    "from_status" "SubscriptionStatus",
    "to_status" "SubscriptionStatus",
    "from_plan_id" UUID,
    "to_plan_id" UUID,
    "from_period_end" TIMESTAMPTZ(3),
    "to_period_end" TIMESTAMPTZ(3),
    "reason" VARCHAR(500),
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" VARCHAR(60) NOT NULL,
    "entity_type" VARCHAR(40) NOT NULL,
    "entity_id" VARCHAR(60) NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" VARCHAR(500),
    "result" "AuditResult" NOT NULL DEFAULT 'SUCCESS',
    "ip" VARCHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "audience" "NotificationAudience" NOT NULL,
    "tenant_id" UUID,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "body" VARCHAR(1000) NOT NULL,
    "link" VARCHAR(300),
    "dedupe_key" VARCHAR(200) NOT NULL,
    "read_at" TIMESTAMPTZ(3),
    "email_status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "platform_name" VARCHAR(60) NOT NULL DEFAULT 'ModaFlow',
    "contact_email" VARCHAR(254),
    "support_whatsapp" VARCHAR(20),
    "currency" CHAR(3) NOT NULL DEFAULT 'BOB',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'America/La_Paz',
    "trial_days" INTEGER NOT NULL DEFAULT 14,
    "renewal_notice_days" INTEGER NOT NULL DEFAULT 5,
    "renewal_policy" VARCHAR(1000),
    "data_retention_days" INTEGER NOT NULL DEFAULT 30,
    "qr_enabled" BOOLEAN NOT NULL DEFAULT false,
    "transfer_enabled" BOOLEAN NOT NULL DEFAULT false,
    "account_holder" VARCHAR(120),
    "bank_name" VARCHAR(80),
    "account_number" VARCHAR(40),
    "account_type" VARCHAR(40),
    "payment_instructions" VARCHAR(1000),
    "qr_image_key" VARCHAR(300),
    "notification_emails" TEXT[],
    "email_templates" JSONB,
    "updated_by_id" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_versions_plan_id_version_key" ON "plan_versions"("plan_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_periods_payment_request_id_key" ON "subscription_periods"("payment_request_id");

-- CreateIndex
CREATE INDEX "subscription_periods_tenant_id_period_start_idx" ON "subscription_periods"("tenant_id", "period_start");

-- CreateIndex
CREATE INDEX "subscription_periods_subscription_id_idx" ON "subscription_periods"("subscription_id");

-- CreateIndex
CREATE INDEX "subscription_history_tenant_id_created_at_idx" ON "subscription_history"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "subscription_history_action_created_at_idx" ON "subscription_history"("action", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_entity_type_entity_id_idx" ON "admin_audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "admin_audit_logs_actor_id_created_at_idx" ON "admin_audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_created_at_idx" ON "notifications"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_audience_created_at_idx" ON "notifications"("audience", "created_at");

-- CreateIndex
CREATE INDEX "plan_change_requests_status_created_at_idx" ON "plan_change_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "plan_change_requests_reviewed_at_idx" ON "plan_change_requests"("reviewed_at");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_version_id_fkey" FOREIGN KEY ("plan_version_id") REFERENCES "plan_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_change_requests" ADD CONSTRAINT "plan_change_requests_plan_version_id_fkey" FOREIGN KEY ("plan_version_id") REFERENCES "plan_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_change_requests" ADD CONSTRAINT "plan_change_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_versions" ADD CONSTRAINT "plan_versions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_versions" ADD CONSTRAINT "plan_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_periods" ADD CONSTRAINT "subscription_periods_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_periods" ADD CONSTRAINT "subscription_periods_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_periods" ADD CONSTRAINT "subscription_periods_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_periods" ADD CONSTRAINT "subscription_periods_plan_version_id_fkey" FOREIGN KEY ("plan_version_id") REFERENCES "plan_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_periods" ADD CONSTRAINT "subscription_periods_payment_request_id_fkey" FOREIGN KEY ("payment_request_id") REFERENCES "plan_change_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_periods" ADD CONSTRAINT "subscription_periods_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: version 1 of every plan with its current commercial conditions.
INSERT INTO "plan_versions" ("id", "plan_id", "version", "name", "price_cents", "billing_period", "duration_days", "max_products",
  "ai_analyses_limit", "ai_analyses_period", "max_users", "max_branches", "inventory_and_sales", "advanced_reports",
  "online_catalog", "advanced_management", "is_trial", "created_at")
SELECT gen_random_uuid(), p."id", 1, p."name", p."price_cents", p."billing_period", p."duration_days", p."max_products",
  p."ai_analyses_limit", p."ai_analyses_period", p."max_users", p."max_branches", p."inventory_and_sales", p."advanced_reports",
  p."online_catalog", p."advanced_management", p."is_trial", now()
FROM "plans" p;

UPDATE "subscriptions" s SET "plan_version_id" = v."id"
FROM "plan_versions" v WHERE v."plan_id" = s."plan_id" AND v."version" = 1;

-- Existing trials become their first recorded period (no money involved).
INSERT INTO "subscription_periods" ("id", "subscription_id", "tenant_id", "plan_id", "plan_version_id", "kind", "period_start", "period_end", "amount", "note", "created_at")
SELECT gen_random_uuid(), s."id", s."tenant_id", s."plan_id", s."plan_version_id", 'TRIAL', s."started_at", s."current_period_end", 0, 'Prueba gratuita (registrada al migrar)', now()
FROM "subscriptions" s JOIN "plans" p ON p."id" = s."plan_id"
WHERE p."is_trial" AND s."current_period_end" > s."started_at";

INSERT INTO "platform_settings" ("id", "notification_emails", "updated_at") VALUES (1, '{}', now());

-- One pending payment request per business: already enforced by the
-- plan_change_requests_one_pending_per_tenant partial index (Stage 1).

ALTER TABLE "platform_settings"
  ADD CONSTRAINT "platform_settings_singleton" CHECK ("id" = 1),
  ADD CONSTRAINT "platform_settings_days_valid" CHECK ("trial_days" BETWEEN 1 AND 90 AND "renewal_notice_days" BETWEEN 0 AND 30 AND "data_retention_days" BETWEEN 0 AND 3650);

ALTER TABLE "plan_versions" ADD CONSTRAINT "plan_versions_values_valid" CHECK ("version" > 0 AND "price_cents" >= 0 AND "max_products" >= 0 AND "ai_analyses_limit" >= 0 AND "max_users" >= 1 AND "max_branches" >= 1);

ALTER TABLE "subscription_periods" ADD CONSTRAINT "subscription_periods_valid" CHECK ("period_end" > "period_start" AND "amount" >= 0);

ALTER TABLE "plan_change_requests"
  ADD CONSTRAINT "plan_change_requests_amounts_valid" CHECK (("amount_expected" IS NULL OR "amount_expected" >= 0) AND ("amount_confirmed" IS NULL OR "amount_confirmed" >= 0)),
  ADD CONSTRAINT "plan_change_requests_review_consistent" CHECK (("status" IN ('APPROVED', 'REJECTED')) = ("reviewed_at" IS NOT NULL AND "reviewed_by_id" IS NOT NULL) OR "amount_expected" IS NULL),
  ADD CONSTRAINT "plan_change_requests_approved_amount" CHECK ("status" <> 'APPROVED' OR "amount_expected" IS NULL OR "amount_confirmed" IS NOT NULL);

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_suspension_consistent" CHECK (("status" = 'SUSPENDED') = ("suspended_at" IS NOT NULL));

-- Audit records are append-only.
CREATE FUNCTION "admin_audit_logs_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_logs is append-only';
END;
$$;

CREATE TRIGGER "admin_audit_logs_no_update" BEFORE UPDATE OR DELETE ON "admin_audit_logs"
FOR EACH ROW EXECUTE FUNCTION "admin_audit_logs_immutable"();
