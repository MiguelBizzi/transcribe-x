/*
  Warnings:

  - Changed the type of `action` on the `recent_activity` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "RecentActivityAction" AS ENUM ('TRANSCRIPTION_CREATED', 'TRANSCRIPTION_COMPLETED', 'TRANSCRIPTION_FAILED', 'CHAT_STARTED', 'CHAT_MESSAGE_SENT', 'EXPORT_CREATED', 'EXPORT_COMPLETED', 'EXPORT_FAILED', 'CREDIT_USED', 'CREDIT_ADDED', 'LOGOUT');

-- AlterTable
ALTER TABLE "recent_activity" DROP COLUMN "action",
ADD COLUMN     "action" "RecentActivityAction" NOT NULL;
