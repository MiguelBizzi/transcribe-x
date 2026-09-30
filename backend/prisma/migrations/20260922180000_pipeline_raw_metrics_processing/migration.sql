-- AlterTable
ALTER TABLE "transcriptions" ADD COLUMN "raw_quality_metrics" JSONB;

-- AlterEnum
ALTER TYPE "TranscriptionStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
