import { prisma } from '../lib/prisma'
import { transcriptionService } from './transcription-service'
import { youtubeService } from './youtube-service'
import { textQualityService } from './text-quality-service'
import {
    TranscriptionStatus,
    TranscriptionType,
} from '@/generated/prisma/client'
import type { Prisma } from '@/generated/prisma/client'

export interface PlaylistTranscriptionResult {
    success: boolean
    playlistId: string
    totalVideos: number
    processedVideos: number
    failedVideos: number
    status: TranscriptionStatus
    error?: string
}

const processingPlaylists = new Set<string>()

export class PlaylistTranscriptionService {
    async createPlaylistTranscription(
        userId: string,
        playlistUrl: string,
    ): Promise<PlaylistTranscriptionResult> {
        const playlistId = youtubeService.extractPlaylistId(playlistUrl)
        if (!playlistId) {
            return {
                success: false,
                playlistId: '',
                totalVideos: 0,
                processedVideos: 0,
                failedVideos: 0,
                status: TranscriptionStatus.ERROR,
                error: 'Invalid YouTube playlist URL',
            }
        }

        const playlistDetails =
            await youtubeService.getPlaylistDetailsByUrl(playlistUrl)
        const playlistVideos = await youtubeService.getPlaylistVideos(playlistId)

        if (playlistVideos.length === 0) {
            return {
                success: false,
                playlistId,
                totalVideos: 0,
                processedVideos: 0,
                failedVideos: 0,
                status: TranscriptionStatus.ERROR,
                error: 'No videos found in playlist',
            }
        }

        const totalDuration = playlistVideos.reduce(
            (sum, video) => sum + video.duration,
            0,
        )

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
                status: TranscriptionStatus.PROCESSING,
                processingStartedAt: new Date(),
            },
        })

        void this.processPlaylistVideos(playlist.id, userId, playlistVideos)

        return {
            success: true,
            playlistId: playlist.id,
            totalVideos: playlistVideos.length,
            processedVideos: 0,
            failedVideos: 0,
            status: TranscriptionStatus.PROCESSING,
        }
    }

    async processPlaylistVideos(
        playlistDbId: string,
        userId: string,
        playlistVideos: Array<{
            id: string
            title: string
            thumbnail: string
            duration: number
            position: number
        }>,
    ): Promise<void> {
        if (processingPlaylists.has(playlistDbId)) {
            return
        }
        processingPlaylists.add(playlistDbId)

        try {
            let processedVideos = 0
            let failedVideos = 0
            let totalWordCount = 0

            for (const video of playlistVideos) {
                try {
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
                                    timestamps:
                                        transcriptResult.timestamps as Prisma.InputJsonValue,
                                    completedAt: new Date(),
                                    playlistId: playlistDbId,
                                    videoIndex: video.position,
                                    isPlaylistVideo: true,
                                },
                            },
                        )

                        await textQualityService.processAndPersist(
                            transcription.id,
                            transcriptResult.raw_text,
                            transcriptResult.language_code,
                            Boolean(transcriptResult.is_generated),
                        )

                        processedVideos += 1
                        totalWordCount += transcriptResult.word_count || 0
                    } else {
                        await prisma.transcription.create({
                            data: {
                                userId,
                                youtubeId: video.id,
                                title: video.title,
                                type: TranscriptionType.VIDEO,
                                thumbnail: video.thumbnail,
                                status: TranscriptionStatus.ERROR,
                                content: null,
                                duration: video.duration,
                                errorMessage:
                                    transcriptResult.error ||
                                    'Failed to get transcript',
                                playlistId: playlistDbId,
                                videoIndex: video.position,
                                isPlaylistVideo: true,
                            },
                        })
                        failedVideos += 1
                    }
                } catch (error) {
                    await prisma.transcription.create({
                        data: {
                            userId,
                            youtubeId: video.id,
                            title: video.title,
                            type: TranscriptionType.VIDEO,
                            thumbnail: video.thumbnail,
                            status: TranscriptionStatus.ERROR,
                            content: null,
                            duration: video.duration,
                            errorMessage:
                                error instanceof Error
                                    ? error.message
                                    : 'Unknown error',
                            playlistId: playlistDbId,
                            videoIndex: video.position,
                            isPlaylistVideo: true,
                        },
                    })
                    failedVideos += 1
                }
            }

            await prisma.playlist.update({
                where: { id: playlistDbId },
                data: {
                    status:
                        failedVideos > 0 && processedVideos === 0
                            ? TranscriptionStatus.ERROR
                            : TranscriptionStatus.COMPLETED,
                    totalWordCount,
                    completedAt: new Date(),
                    errorMessage:
                        failedVideos > 0
                            ? `${failedVideos} videos failed to transcribe`
                            : null,
                },
            })
        } catch (error) {
            await prisma.playlist.update({
                where: { id: playlistDbId },
                data: {
                    status: TranscriptionStatus.ERROR,
                    completedAt: new Date(),
                    errorMessage:
                        error instanceof Error
                            ? error.message
                            : 'Unknown error occurred',
                },
            })
        } finally {
            processingPlaylists.delete(playlistDbId)
        }
    }

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
                        thumbnail: true,
                        duration: true,
                        wordCount: true,
                        language: true,
                        timestamps: true,
                        processedContent: true,
                        qualityMetrics: true,
                        isProcessed: true,
                        llmCurationScore: true,
                        llmCurationData: true,
                        errorMessage: true,
                        deduplicationStatus: true,
                        rewrittenContent: true,
                        rewriteMode: true,
                        videoIndex: true,
                        createdAt: true,
                    },
                },
            },
        })
    }
}

export const playlistTranscriptionService = new PlaylistTranscriptionService()
