/*
  Warnings:

  - The values [TRANSCRIPTION_CREATED,TRANSCRIPTION_FAILED] on the enum `RecentActivityAction` will be removed. If these variants are still used in the database, this will fail.
  - The values [QUEUED,PROCESSING,FAILED] on the enum `TranscriptionStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "RecentActivityAction_new" AS ENUM ('TRANSCRIPTION_COMPLETED', 'TRANSCRIPTION_ERROR', 'CHAT_STARTED', 'CHAT_MESSAGE_SENT', 'EXPORT_CREATED', 'EXPORT_COMPLETED', 'EXPORT_FAILED', 'CREDIT_USED', 'CREDIT_ADDED', 'LOGOUT');
ALTER TABLE "recent_activity" ALTER COLUMN "action" TYPE "RecentActivityAction_new" USING ("action"::text::"RecentActivityAction_new");
ALTER TYPE "RecentActivityAction" RENAME TO "RecentActivityAction_old";
ALTER TYPE "RecentActivityAction_new" RENAME TO "RecentActivityAction";
DROP TYPE "RecentActivityAction_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "TranscriptionStatus_new" AS ENUM ('COMPLETED', 'ERROR');
ALTER TABLE "transcriptions" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "transcriptions" ALTER COLUMN "status" TYPE "TranscriptionStatus_new" USING ("status"::text::"TranscriptionStatus_new");
ALTER TYPE "TranscriptionStatus" RENAME TO "TranscriptionStatus_old";
ALTER TYPE "TranscriptionStatus_new" RENAME TO "TranscriptionStatus";
DROP TYPE "TranscriptionStatus_old";
ALTER TABLE "transcriptions" ALTER COLUMN "status" SET DEFAULT 'COMPLETED';
COMMIT;

-- AlterTable
ALTER TABLE "transcriptions" ADD COLUMN     "timestamps" JSONB,
ALTER COLUMN "status" SET DEFAULT 'COMPLETED';
