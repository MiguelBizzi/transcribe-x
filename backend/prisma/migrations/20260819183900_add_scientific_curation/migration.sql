-- AlterTable
ALTER TABLE "transcriptions" ADD COLUMN "mtld_score" FLOAT;
ALTER TABLE "transcriptions" ADD COLUMN "mattr_score" FLOAT;
ALTER TABLE "transcriptions" ADD COLUMN "llm_curation_score" FLOAT;
ALTER TABLE "transcriptions" ADD COLUMN "llm_curation_data" JSONB;
ALTER TABLE "transcriptions" ADD COLUMN "deduplication_status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "transcriptions" ADD COLUMN "dedup_group_id" TEXT;

-- CreateIndex
CREATE INDEX "transcriptions_deduplication_status_idx" ON "transcriptions"("deduplication_status");
CREATE INDEX "transcriptions_dedup_group_id_idx" ON "transcriptions"("dedup_group_id");
