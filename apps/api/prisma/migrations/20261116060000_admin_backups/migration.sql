CREATE TYPE "admin"."BackupStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "admin"."backups" (
    "id" UUID NOT NULL,
    "status" "admin"."BackupStatus" NOT NULL DEFAULT 'RUNNING',
    "storage_key" VARCHAR(300),
    "size_bytes" BIGINT,
    "database_bytes" BIGINT,
    "file_count" INTEGER,
    "files_bytes" BIGINT,
    "error_message" VARCHAR(500),
    "created_by_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),
    CONSTRAINT "backups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "backups_started_at_idx" ON "admin"."backups"("started_at");

ALTER TABLE "admin"."backups" ADD CONSTRAINT "backups_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "admin"."staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "admin"."backups" TO "modaflow_admin";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'modaflow_backup') THEN
    CREATE ROLE "modaflow_backup" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO "modaflow_backup"', current_database());
END
$$;

GRANT "pg_read_all_data" TO "modaflow_backup";
