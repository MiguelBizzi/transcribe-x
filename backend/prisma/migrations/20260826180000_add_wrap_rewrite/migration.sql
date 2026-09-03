-- AlterTable
ALTER TABLE "transcriptions" ADD COLUMN "rewritten_content" TEXT;
ALTER TABLE "transcriptions" ADD COLUMN "rewrite_mode" TEXT;
ALTER TABLE "transcriptions" ADD COLUMN "rewrite_data" JSONB;
