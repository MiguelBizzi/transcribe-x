import { prisma } from '../lib/prisma'
import { youtubeService } from './youtube-service'
import { textQualityService } from './text-quality-service'
import {
    TranscriptionStatus,
    TranscriptionType,
} from '@/generated/prisma/client'
import type { Prisma } from '@/generated/prisma/client'
import { transcriptErrorMessage, isRateLimitedResult } from './transcript-errors'
import {
    fetchTranscriptWithBackoff,
    INTER_VIDEO_DELAY_MS,
    PLAYLIST_RATE_LIMIT_BACKOFF_MS,
    RATE_LIMIT_COOLDOWN_MS,
    sleep,
} from './transcript-attempt'

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
const processingTranscriptions = new Set<string>()

export type RetryStartResult =
    | { outcome: 'started' }
    | { outcome: 'not_found' }
    | { outcome: 'rejected'; message: string }

interface TranscriptRow {
    id: string
    youtubeId: string
}

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
            const rows: TranscriptRow[] = []

            for (const video of playlistVideos) {
                const transcription = await prisma.transcription.create({
                    data: {
                        userId,
                        youtubeId: video.id,
                        title: video.title,
                        type: TranscriptionType.VIDEO,
                        thumbnail: video.thumbnail,
                        status: TranscriptionStatus.PROCESSING,
                        duration: video.duration,
                        playlistId: playlistDbId,
                        videoIndex: video.position,
                        isPlaylistVideo: true,
                        processingStartedAt: new Date(),
                    },
                })
                rows.push({
                    id: transcription.id,
                    youtubeId: video.id,
                })
            }

            await this.transcribeRows(rows)
            await this.refreshPlaylistSummary(playlistDbId)
        } catch (error) {
            await prisma.transcription.updateMany({
                where: {
                    playlistId: playlistDbId,
                    status: TranscriptionStatus.PROCESSING,
                },
                data: {
                    status: TranscriptionStatus.ERROR,
                    errorMessage: 'O processamento da playlist foi interrompido.',
                    completedAt: new Date(),
                },
            })
            await prisma.playlist.update({
                where: { id: playlistDbId },
                data: {
                    status: TranscriptionStatus.ERROR,
                    completedAt: new Date(),
                    errorMessage:
                        error instanceof Error
                            ? error.message
                            : 'Falha ao processar a playlist.',
                },
            })
        } finally {
            processingPlaylists.delete(playlistDbId)
        }
    }

    async startRetry(
        transcriptionId: string,
        userId: string,
    ): Promise<RetryStartResult & { playlistId?: string | null }> {
        if (processingTranscriptions.has(transcriptionId)) {
            const current = await prisma.transcription.findFirst({
                where: { id: transcriptionId, userId },
                select: { playlistId: true },
            })
            if (!current) return { outcome: 'not_found' }
            return {
                outcome: 'started',
                playlistId: current.playlistId,
            }
        }

        processingTranscriptions.add(transcriptionId)

        try {
            const transcription = await prisma.transcription.findFirst({
                where: { id: transcriptionId, userId },
                select: {
                    id: true,
                    youtubeId: true,
                    status: true,
                    playlistId: true,
                },
            })

            if (!transcription) {
                processingTranscriptions.delete(transcriptionId)
                return { outcome: 'not_found' }
            }

            if (transcription.status !== TranscriptionStatus.ERROR) {
                processingTranscriptions.delete(transcriptionId)
                return {
                    outcome: 'rejected',
                    message:
                        'Só é possível tentar novamente uma transcrição com erro.',
                    playlistId: transcription.playlistId,
                }
            }

            if (
                transcription.playlistId &&
                processingPlaylists.has(transcription.playlistId)
            ) {
                processingTranscriptions.delete(transcriptionId)
                return {
                    outcome: 'rejected',
                    message: 'A playlist ainda está em processamento.',
                    playlistId: transcription.playlistId,
                }
            }

            await prisma.transcription.update({
                where: { id: transcription.id },
                data: {
                    status: TranscriptionStatus.PROCESSING,
                    errorMessage: null,
                    processingStartedAt: new Date(),
                    completedAt: null,
                },
            })

            if (transcription.playlistId) {
                await prisma.playlist.update({
                    where: { id: transcription.playlistId },
                    data: {
                        status: TranscriptionStatus.PROCESSING,
                        errorMessage: null,
                        completedAt: null,
                    },
                })
            }

            void this.finishSingleRetry(
                transcription.id,
                transcription.youtubeId,
                transcription.playlistId,
            )

            return {
                outcome: 'started',
                playlistId: transcription.playlistId,
            }
        } catch (error) {
            processingTranscriptions.delete(transcriptionId)
            throw error
        }
    }

    async startRetryFailed(
        playlistId: string,
        userId: string,
    ): Promise<RetryStartResult & { retried?: number }> {
        if (processingPlaylists.has(playlistId)) {
            return {
                outcome: 'rejected',
                message: 'A playlist já está em processamento.',
            }
        }

        processingPlaylists.add(playlistId)

        try {
            const playlist = await prisma.playlist.findFirst({
                where: { id: playlistId, userId },
                select: {
                    id: true,
                    transcriptions: {
                        where: {
                            status: {
                                in: [
                                    TranscriptionStatus.ERROR,
                                    TranscriptionStatus.PROCESSING,
                                ],
                            },
                        },
                        orderBy: { videoIndex: 'asc' },
                        select: { id: true, youtubeId: true },
                    },
                },
            })

            if (!playlist) {
                processingPlaylists.delete(playlistId)
                return { outcome: 'not_found' }
            }

            if (playlist.transcriptions.length === 0) {
                processingPlaylists.delete(playlistId)
                return {
                    outcome: 'rejected',
                    message: 'Nenhum vídeo pendente para tentar novamente.',
                }
            }

            const ids = playlist.transcriptions.map((item) => item.id)

            await prisma.playlist.update({
                where: { id: playlistId },
                data: {
                    status: TranscriptionStatus.PROCESSING,
                    errorMessage: null,
                    completedAt: null,
                },
            })

            await prisma.transcription.updateMany({
                where: { id: { in: ids }, userId },
                data: {
                    status: TranscriptionStatus.PROCESSING,
                    errorMessage: null,
                    processingStartedAt: new Date(),
                    completedAt: null,
                },
            })

            void this.finishFailedRetry(playlistId, playlist.transcriptions)

            return {
                outcome: 'started',
                retried: playlist.transcriptions.length,
            }
        } catch (error) {
            processingPlaylists.delete(playlistId)
            throw error
        }
    }

    private async finishSingleRetry(
        transcriptionId: string,
        youtubeId: string,
        playlistId: string | null,
    ): Promise<void> {
        try {
            await this.applyTranscript(transcriptionId, youtubeId)
            if (playlistId) {
                await this.refreshPlaylistSummary(playlistId)
            }
        } catch {
            if (playlistId) {
                await prisma.playlist
                    .update({
                        where: { id: playlistId },
                        data: {
                            status: TranscriptionStatus.ERROR,
                            errorMessage:
                                'Falha ao atualizar o estado da playlist.',
                            completedAt: new Date(),
                        },
                    })
                    .catch(() => undefined)
            }
        } finally {
            processingTranscriptions.delete(transcriptionId)
        }
    }

    private async finishFailedRetry(
        playlistId: string,
        rows: TranscriptRow[],
    ): Promise<void> {
        try {
            await this.transcribeRows(rows)
            await this.refreshPlaylistSummary(playlistId)
        } catch (error) {
            await prisma.transcription.updateMany({
                where: {
                    playlistId,
                    status: TranscriptionStatus.PROCESSING,
                },
                data: {
                    status: TranscriptionStatus.ERROR,
                    errorMessage:
                        'O processamento da playlist foi interrompido.',
                    completedAt: new Date(),
                },
            })
            await prisma.playlist.update({
                where: { id: playlistId },
                data: {
                    status: TranscriptionStatus.ERROR,
                    completedAt: new Date(),
                    errorMessage:
                        error instanceof Error
                            ? error.message
                            : 'Falha ao processar a playlist.',
                },
            })
        } finally {
            processingPlaylists.delete(playlistId)
        }
    }

    private async transcribeRows(rows: TranscriptRow[]): Promise<void> {
        let lastWasRateLimited = false

        for (const [index, row] of rows.entries()) {
            if (index > 0) {
                await sleep(
                    lastWasRateLimited
                        ? RATE_LIMIT_COOLDOWN_MS
                        : INTER_VIDEO_DELAY_MS,
                )
            }

            const outcome = await this.applyTranscript(row.id, row.youtubeId, {
                backoffMs: PLAYLIST_RATE_LIMIT_BACKOFF_MS,
            })
            lastWasRateLimited = outcome.rateLimited
        }
    }

    private async applyTranscript(
        transcriptionId: string,
        youtubeId: string,
        options?: { backoffMs?: number[] },
    ): Promise<{ rateLimited: boolean }> {
        try {
            const result = await fetchTranscriptWithBackoff(youtubeId, {
                backoffMs: options?.backoffMs,
                onWait: async () => {
                    await prisma.transcription.update({
                        where: { id: transcriptionId },
                        data: {
                            errorMessage:
                                'O YouTube limitou temporariamente o acesso às legendas. Tentando de novo em instantes.',
                        },
                    })
                },
            })

            if (result.success && result.raw_text) {
                await prisma.transcription.update({
                    where: { id: transcriptionId },
                    data: {
                        status: TranscriptionStatus.COMPLETED,
                        content: result.raw_text,
                        wordCount: result.word_count || 0,
                        language: result.language_code,
                        timestamps: result.timestamps as Prisma.InputJsonValue,
                        errorMessage: null,
                        completedAt: new Date(),
                    },
                })

                await textQualityService.processAndPersist(
                    transcriptionId,
                    result.raw_text,
                    result.language_code,
                    Boolean(result.is_generated),
                )

                return { rateLimited: false }
            }

            const rateLimited = isRateLimitedResult(result)
            await prisma.transcription.update({
                where: { id: transcriptionId },
                data: {
                    status: TranscriptionStatus.ERROR,
                    content: null,
                    errorMessage: transcriptErrorMessage(result),
                    completedAt: new Date(),
                },
            })

            return { rateLimited }
        } catch {
            await prisma.transcription.update({
                where: { id: transcriptionId },
                data: {
                    status: TranscriptionStatus.ERROR,
                    content: null,
                    errorMessage: 'Falha ao obter a legenda deste vídeo.',
                    completedAt: new Date(),
                },
            })
            return { rateLimited: false }
        }
    }

    private async refreshPlaylistSummary(playlistId: string): Promise<void> {
        const transcriptions = await prisma.transcription.findMany({
            where: { playlistId },
            select: { status: true, wordCount: true },
        })

        const failed = transcriptions.filter(
            (item) => item.status === TranscriptionStatus.ERROR,
        ).length
        const processing = transcriptions.filter(
            (item) => item.status === TranscriptionStatus.PROCESSING,
        ).length
        const completed = transcriptions.filter(
            (item) => item.status === TranscriptionStatus.COMPLETED,
        ).length
        const totalWordCount = transcriptions.reduce(
            (sum, item) =>
                item.status === TranscriptionStatus.COMPLETED
                    ? sum + (item.wordCount ?? 0)
                    : sum,
            0,
        )

        if (processing > 0) {
            await prisma.playlist.update({
                where: { id: playlistId },
                data: {
                    status: TranscriptionStatus.PROCESSING,
                    errorMessage: null,
                    completedAt: null,
                    totalWordCount,
                },
            })
            return
        }

        await prisma.playlist.update({
            where: { id: playlistId },
            data: {
                status:
                    failed > 0 && completed === 0
                        ? TranscriptionStatus.ERROR
                        : TranscriptionStatus.COMPLETED,
                errorMessage:
                    failed > 0
                        ? `${failed} vídeos não puderam ser transcritos`
                        : null,
                totalWordCount,
                completedAt: new Date(),
            },
        })
    }

    async resumeInterruptedPlaylists(): Promise<void> {
        const playlists = await prisma.playlist.findMany({
            where: { status: TranscriptionStatus.PROCESSING },
            select: {
                id: true,
                transcriptions: {
                    where: { status: TranscriptionStatus.PROCESSING },
                    orderBy: { videoIndex: 'asc' },
                    select: { id: true, youtubeId: true },
                },
            },
        })

        for (const playlist of playlists) {
            if (processingPlaylists.has(playlist.id)) continue

            if (playlist.transcriptions.length === 0) {
                await this.refreshPlaylistSummary(playlist.id)
                continue
            }

            processingPlaylists.add(playlist.id)
            console.log(
                `Resuming playlist ${playlist.id} with ${playlist.transcriptions.length} videos left`,
            )
            void this.finishFailedRetry(playlist.id, playlist.transcriptions)
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
                        videoIndex: true,
                        createdAt: true,
                    },
                },
            },
        })
    }
}

export const playlistTranscriptionService = new PlaylistTranscriptionService()
