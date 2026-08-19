-- Delete credit-related activity before narrowing the enum
DELETE FROM "recent_activity" WHERE "action" IN ('CREDIT_USED', 'CREDIT_ADDED');

-- Drop credit tables
DROP TABLE IF EXISTS "credit_usage";
DROP TABLE IF EXISTS "credits";

-- AlterEnum
BEGIN;
CREATE TYPE "RecentActivityAction_new" AS ENUM ('LOGOUT');
ALTER TABLE "recent_activity" ALTER COLUMN "action" TYPE "RecentActivityAction_new" USING ("action"::text::"RecentActivityAction_new");
ALTER TYPE "RecentActivityAction" RENAME TO "RecentActivityAction_old";
ALTER TYPE "RecentActivityAction_new" RENAME TO "RecentActivityAction";
DROP TYPE "RecentActivityAction_old";
COMMIT;
