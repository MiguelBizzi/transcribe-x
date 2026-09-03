-- AlterTable
ALTER TABLE "transcriptions" ADD COLUMN "rewritten_quality_metrics" JSONB;
ALTER TABLE "transcriptions" ADD COLUMN "rewritten_llm_curation_score" FLOAT;
ALTER TABLE "transcriptions" ADD COLUMN "rewritten_llm_curation_data" JSONB;
