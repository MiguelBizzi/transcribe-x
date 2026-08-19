import { prisma } from '../lib/prisma'
import { transcriptionService } from './transcription-service'
import { youtubeService } from './youtube-service'
import { TranscriptionStatus, TranscriptionType } from '@/generated/prisma/client'

export interface PlaylistTranscriptionResult {
    success: boolean
    playlistId: string
    totalVideos: number
    processedVideos: number
    failedVideos: number
    error?: string
}

export interface PlaylistVideoTranscription {
    videoId: string
    title: string
    success: boolean
    transcriptionId?: string
    error?: string
}

export class PlaylistTranscriptionService {
    /**
     * Create a new playlist transcription
     */
    async createPlaylistTranscription(
        userId: string,
        playlistUrl: string,
    ): Promise<PlaylistTranscriptionResult> {
        try {
            // Extract playlist ID and get details from YouTube service
            const playlistId = youtubeService.extractPlaylistId(playlistUrl)
            if (!playlistId) {
                return {
                    success: false,
                    playlistId: '',
                    totalVideos: 0,
                    processedVideos: 0,
                    failedVideos: 0,
                    error: 'Invalid YouTube playlist URL',
                }
            }

            // Get playlist details from YouTube service (TypeScript)
            const playlistDetails =
                await youtubeService.getPlaylistDetailsByUrl(playlistUrl)

            // Get all videos in the playlist from YouTube service (TypeScript)
            const playlistVideos =
                await youtubeService.getPlaylistVideos(playlistId)

            if (playlistVideos.length === 0) {
                return {
                    success: false,
                    playlistId,
                    totalVideos: 0,
                    processedVideos: 0,
                    failedVideos: 0,
                    error: 'No videos found in playlist',
                }
            }

            const totalDuration = playlistVideos.reduce(
                (sum, video) => sum + video.duration,
                0,
            )

            // Create playlist record in database
            const playlist = await prisma.playlist.create({
                data: {
                    userId,
                    youtubeId: playlistId,
                    title: playlistDetails.title,
                    description: playlistDetails.description,
                    channelTitle: playlistDetails.channelTitle,
                    channelId: playlistDetails.channelId,
                    thumbnail: playlistDetails.thumbnail,
                    videoCount: playlistVideos.length,
                    totalDuration,
                    status: TranscriptionStatus.COMPLETED,
                    processingStartedAt: new Date(),
                },
            })

            // Process each video in the playlist
            const results: PlaylistVideoTranscription[] = []

            for (const video of playlistVideos) {
                try {
                    // Get transcript for the video using Python service
                    const transcriptResult =
                        await transcriptionService.getTranscriptById(video.id)

                    if (transcriptResult.success && transcriptResult.raw_text) {
                        const transcription = await prisma.transcription.create(
                            {
                                data: {
                                    userId,
                                    youtubeId: video.id,
                                    title: video.title,
                                    type: TranscriptionType.VIDEO,
                                    thumbnail: video.thumbnail,
                                    status: TranscriptionStatus.COMPLETED,
                                    content: transcriptResult.raw_text,
                                    duration: video.duration,
                                    wordCount: transcriptResult.word_count || 0,
                                    language: transcriptResult.language_code,
                                    timestamps: transcriptResult.timestamps,
                                    completedAt: new Date(),
                                    playlistId: playlist.id,
                                    videoIndex: video.position,
                                    isPlaylistVideo: true,
                                },
                            },
                        )

                        results.push({
                            videoId: video.id,
                            title: video.title,
                            success: true,
                            transcriptionId: transcription.id,
                        })
                    } else {
                        results.push({
                            videoId: video.id,
                            title: video.title,
                            success: false,
                            error:
                                transcriptResult.error ||
                                'Failed to get transcript',
                        })
                    }
                } catch (error) {
                    results.push({
                        videoId: video.id,
                        title: video.title,
                        success: false,
                        error:
                            error instanceof Error
                                ? error.message
                                : 'Unknown error',
                    })
                }
            }

            // Update playlist with final status
            const processedVideos = results.filter((r) => r.success).length
            const failedVideos = results.filter((r) => !r.success).length
            const totalWordCount = results
                .filter((r) => r.success)
                .reduce((sum, r) => sum + (r.transcriptionId ? 1 : 0), 0)

            await prisma.playlist.update({
                where: { id: playlist.id },
                data: {
                    status:
                        failedVideos === 0
                            ? TranscriptionStatus.COMPLETED
                            : TranscriptionStatus.ERROR,
                    totalWordCount,
                    completedAt: new Date(),
                    errorMessage:
                        failedVideos > 0
                            ? `${failedVideos} videos failed to transcribe`
                            : null,
                },
            })

            return {
                success: true,
                playlistId: playlist.id,
                totalVideos: playlistVideos.length,
                processedVideos,
                failedVideos,
            }
        } catch (error) {
            return {
                success: false,
                playlistId: '',
                totalVideos: 0,
                processedVideos: 0,
                failedVideos: 0,
                error:
                    error instanceof Error
                        ? error.message
                        : 'Unknown error occurred',
            }
        }
    }

    /**
     * Get playlist transcriptions for a user
     */
    async getUserPlaylists(userId: string) {
        return prisma.playlist.findMany({
            where: { userId },
            include: {
                transcriptions: {
                    orderBy: { videoIndex: 'asc' },
                    select: {
                        id: true,
                        youtubeId: true,
                        title: true,
                        status: true,
                        duration: true,
                        wordCount: true,
                        videoIndex: true,
                        createdAt: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        })
    }

    /**
     * Get playlist by ID with all transcriptions
     */
    async getPlaylistById(playlistId: string, userId: string) {
        return prisma.playlist.findFirst({
            where: { id: playlistId, userId },
            include: {
                transcriptions: {
                    orderBy: { videoIndex: 'asc' },
                    select: {
                        id: true,
                        youtubeId: true,
                        title: true,
                        status: true,
                        content: true,
                        duration: true,
                        wordCount: true,
                        language: true,
                        timestamps: true,
                        videoIndex: true,
                        createdAt: true,
                    },
                },
            },
        })
    }
}

export const playlistTranscriptionService = new PlaylistTranscriptionService()
