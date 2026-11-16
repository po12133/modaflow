CREATE TYPE "admin"."BackupSource" AS ENUM ('CREATED', 'IMPORTED');

ALTER TABLE "admin"."backups" ADD COLUMN "source" "admin"."BackupSource" NOT NULL DEFAULT 'CREATED';
