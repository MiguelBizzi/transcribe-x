-- AlterTable
ALTER TABLE "transcriptions" ADD COLUMN     "is_playlist_video" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "playlist_id" TEXT,
ADD COLUMN     "video_index" INTEGER;

-- CreateTable
CREATE TABLE "playlists" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "youtube_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "channel_title" TEXT,
    "channel_id" TEXT,
    "thumbnail" TEXT,
    "video_count" INTEGER NOT NULL,
    "status" "TranscriptionStatus" NOT NULL DEFAULT 'COMPLETED',
    "total_duration" INTEGER,
    "total_word_count" INTEGER,
    "error_message" TEXT,
    "processing_started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playlists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "playlists_user_id_idx" ON "playlists"("user_id");

-- CreateIndex
CREATE INDEX "playlists_youtube_id_idx" ON "playlists"("youtube_id");

-- CreateIndex
CREATE INDEX "playlists_status_idx" ON "playlists"("status");

-- CreateIndex
CREATE INDEX "playlists_created_at_idx" ON "playlists"("created_at");

-- CreateIndex
CREATE INDEX "playlists_user_id_created_at_idx" ON "playlists"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "transcriptions_playlist_id_idx" ON "transcriptions"("playlist_id");

-- AddForeignKey
ALTER TABLE "transcriptions" ADD CONSTRAINT "transcriptions_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
