-- AlterTable
ALTER TABLE "transcriptions" ADD COLUMN "processed_content" TEXT;
ALTER TABLE "transcriptions" ADD COLUMN "quality_metrics" JSONB;
ALTER TABLE "transcriptions" ADD COLUMN "is_processed" BOOLEAN NOT NULL DEFAULT false;
