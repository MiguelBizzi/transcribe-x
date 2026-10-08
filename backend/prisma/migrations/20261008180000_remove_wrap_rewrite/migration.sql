-- DropColumn
ALTER TABLE "transcriptions" DROP COLUMN "rewritten_content";
ALTER TABLE "transcriptions" DROP COLUMN "rewrite_mode";
ALTER TABLE "transcriptions" DROP COLUMN "rewrite_data";
ALTER TABLE "transcriptions" DROP COLUMN "rewritten_quality_metrics";
ALTER TABLE "transcriptions" DROP COLUMN "rewritten_llm_curation_score";
ALTER TABLE "transcriptions" DROP COLUMN "rewritten_llm_curation_data";
