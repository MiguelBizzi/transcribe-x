/*
  Warnings:

  - The values [TRANSCRIPTION_COMPLETED,TRANSCRIPTION_ERROR,CHAT_STARTED,CHAT_MESSAGE_SENT,EXPORT_CREATED,EXPORT_COMPLETED,EXPORT_FAILED] on the enum `RecentActivityAction` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `transcription_id` on the `recent_activity` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "RecentActivityAction_new" AS ENUM ('CREDIT_USED', 'CREDIT_ADDED', 'LOGOUT');
ALTER TABLE "recent_activity" ALTER COLUMN "action" TYPE "RecentActivityAction_new" USING ("action"::text::"RecentActivityAction_new");
ALTER TYPE "RecentActivityAction" RENAME TO "RecentActivityAction_old";
ALTER TYPE "RecentActivityAction_new" RENAME TO "RecentActivityAction";
DROP TYPE "RecentActivityAction_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "recent_activity" DROP CONSTRAINT "recent_activity_transcription_id_fkey";

-- DropIndex
DROP INDEX "recent_activity_transcription_id_idx";

-- AlterTable
ALTER TABLE "recent_activity" DROP COLUMN "transcription_id";
