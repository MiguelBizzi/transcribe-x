-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE', 'CREDENTIALS');

-- CreateEnum
CREATE TYPE "TranscriptionType" AS ENUM ('VIDEO', 'PLAYLIST', 'CHANNEL');

-- CreateEnum
CREATE TYPE "TranscriptionStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('TXT', 'PDF', 'DOCX', 'JSON');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('USER', 'AI');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "provider" "AuthProvider" NOT NULL DEFAULT 'CREDENTIALS',
    "password_hash" TEXT,
    "google_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credits" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_usage" (
    "id" TEXT NOT NULL,
    "credit_id" TEXT NOT NULL,
    "transcription_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "youtube_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "TranscriptionType" NOT NULL,
    "thumbnail" TEXT,
    "status" "TranscriptionStatus" NOT NULL DEFAULT 'QUEUED',
    "content" TEXT,
    "duration" INTEGER,
    "word_count" INTEGER,
    "language" TEXT,
    "error_message" TEXT,
    "processing_started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transcriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exports" (
    "id" TEXT NOT NULL,
    "transcription_id" TEXT NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "file_url" TEXT,
    "file_size" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "transcription_id" TEXT NOT NULL,
    "title" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "chat_session_id" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "tokens" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recent_activity" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "transcription_id" TEXT,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recent_activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "credits_user_id_idx" ON "credits"("user_id");

-- CreateIndex
CREATE INDEX "credit_usage_credit_id_idx" ON "credit_usage"("credit_id");

-- CreateIndex
CREATE INDEX "credit_usage_transcription_id_idx" ON "credit_usage"("transcription_id");

-- CreateIndex
CREATE INDEX "transcriptions_user_id_idx" ON "transcriptions"("user_id");

-- CreateIndex
CREATE INDEX "transcriptions_youtube_id_idx" ON "transcriptions"("youtube_id");

-- CreateIndex
CREATE INDEX "transcriptions_status_idx" ON "transcriptions"("status");

-- CreateIndex
CREATE INDEX "transcriptions_created_at_idx" ON "transcriptions"("created_at");

-- CreateIndex
CREATE INDEX "transcriptions_user_id_created_at_idx" ON "transcriptions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "exports_transcription_id_idx" ON "exports"("transcription_id");

-- CreateIndex
CREATE INDEX "exports_status_idx" ON "exports"("status");

-- CreateIndex
CREATE INDEX "chat_sessions_user_id_idx" ON "chat_sessions"("user_id");

-- CreateIndex
CREATE INDEX "chat_sessions_transcription_id_idx" ON "chat_sessions"("transcription_id");

-- CreateIndex
CREATE INDEX "chat_sessions_created_at_idx" ON "chat_sessions"("created_at");

-- CreateIndex
CREATE INDEX "chat_messages_chat_session_id_idx" ON "chat_messages"("chat_session_id");

-- CreateIndex
CREATE INDEX "chat_messages_created_at_idx" ON "chat_messages"("created_at");

-- CreateIndex
CREATE INDEX "recent_activity_user_id_idx" ON "recent_activity"("user_id");

-- CreateIndex
CREATE INDEX "recent_activity_transcription_id_idx" ON "recent_activity"("transcription_id");

-- CreateIndex
CREATE INDEX "recent_activity_created_at_idx" ON "recent_activity"("created_at");

-- CreateIndex
CREATE INDEX "recent_activity_user_id_created_at_idx" ON "recent_activity"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "credits" ADD CONSTRAINT "credits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_usage" ADD CONSTRAINT "credit_usage_credit_id_fkey" FOREIGN KEY ("credit_id") REFERENCES "credits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_usage" ADD CONSTRAINT "credit_usage_transcription_id_fkey" FOREIGN KEY ("transcription_id") REFERENCES "transcriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcriptions" ADD CONSTRAINT "transcriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exports" ADD CONSTRAINT "exports_transcription_id_fkey" FOREIGN KEY ("transcription_id") REFERENCES "transcriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_transcription_id_fkey" FOREIGN KEY ("transcription_id") REFERENCES "transcriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_chat_session_id_fkey" FOREIGN KEY ("chat_session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recent_activity" ADD CONSTRAINT "recent_activity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recent_activity" ADD CONSTRAINT "recent_activity_transcription_id_fkey" FOREIGN KEY ("transcription_id") REFERENCES "transcriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
