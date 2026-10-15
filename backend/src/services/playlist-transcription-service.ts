import { prisma } from '../lib/prisma'
import { youtubeService } from './youtube-service'
import { textQualityService } from './text-quality-service'
import { transcriptionService } from './transcription-service'
import {
    TranscriptionStatus,
    TranscriptionType,
} from '@/generated/prisma/client'
import type { Prisma } from '@/generated/prisma/client'
import { INTER_VIDEO_DELAY_MS, sleep } from './transcript-attempt'
import {
    interruptedResumePlan,
    retryBatchDecision,
    rowsCancelledAfterRateLimit,
    singleRetryDecision,
    summarizePlaylist,
} from './playlist-rules'
import {
    playlistTranscriptException,
    playlistTranscriptPersistence,
} from './transcript-outcome'

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

            const cancelledForRateLimit = await this.transcribeRows(rows)
            await this.refreshPlaylistSummary(playlistDbId, cancelledForRateLimit)
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

            const decision = singleRetryDecision({
                status: transcription.status,
                playlistStillProcessing: Boolean(
                    transcription.playlistId &&
                        processingPlaylists.has(transcription.playlistId),
                ),
            })
            if (decision.outcome === 'rejected') {
                processingTranscriptions.delete(transcriptionId)
                return {
                    outcome: 'rejected',
                    message: decision.message,
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
                        select: { id: true, youtubeId: true, errorMessage: true },
                    },
                },
            })

            if (!playlist) {
                processingPlaylists.delete(playlistId)
                return { outcome: 'not_found' }
            }

            const decision = retryBatchDecision(playlist.transcriptions)
            if (decision.outcome === 'rejected') {
                processingPlaylists.delete(playlistId)
                return decision
            }

            const retryable = decision.retryable
            const ids = retryable.map((item) => item.id)

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

            void this.finishFailedRetry(playlistId, retryable)

            return {
                outcome: 'started',
                retried: decision.retried,
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
            const cancelledForRateLimit = await this.transcribeRows(rows)
            await this.refreshPlaylistSummary(playlistId, cancelledForRateLimit)
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

    private async transcribeRows(rows: TranscriptRow[]): Promise<boolean> {
        for (const [index, row] of rows.entries()) {
            if (index > 0) {
                await sleep(INTER_VIDEO_DELAY_MS)
            }

            const outcome = await this.applyTranscript(row.id, row.youtubeId)
            if (!outcome.rateLimited) continue

            const cancelled = rowsCancelledAfterRateLimit(rows, index)
            if (cancelled.ids.length > 0) {
                await prisma.transcription.updateMany({
                    where: {
                        id: { in: cancelled.ids },
                        status: TranscriptionStatus.PROCESSING,
                    },
                    data: {
                        status: TranscriptionStatus.ERROR,
                        errorMessage: cancelled.errorMessage,
                        completedAt: new Date(),
                    },
                })
            }

            return true
        }

        return false
    }

    private async applyTranscript(
        transcriptionId: string,
        youtubeId: string,
    ): Promise<{ rateLimited: boolean }> {
        try {
            const result = await transcriptionService.getTranscriptById(youtubeId)
            const persistence = playlistTranscriptPersistence(result)

            if (persistence.kind === 'completed') {
                await prisma.transcription.update({
                    where: { id: transcriptionId },
                    data: {
                        status: TranscriptionStatus.COMPLETED,
                        content: persistence.content,
                        wordCount: persistence.wordCount,
                        language: persistence.language,
                        timestamps:
                            persistence.timestamps as Prisma.InputJsonValue,
                        errorMessage: null,
                        completedAt: new Date(),
                    },
                })

                await textQualityService.processAndPersist(
                    transcriptionId,
                    persistence.content,
                    persistence.language,
                    persistence.isGenerated,
                )

                return { rateLimited: false }
            }

            await prisma.transcription.update({
                where: { id: transcriptionId },
                data: {
                    status: TranscriptionStatus.ERROR,
                    content: null,
                    errorMessage: persistence.errorMessage,
                    completedAt: new Date(),
                },
            })

            return { rateLimited: persistence.rateLimited }
        } catch {
            const failure = playlistTranscriptException()
            await prisma.transcription.update({
                where: { id: transcriptionId },
                data: {
                    status: TranscriptionStatus.ERROR,
                    content: null,
                    errorMessage: failure.errorMessage,
                    completedAt: new Date(),
                },
            })
            return { rateLimited: failure.rateLimited }
        }
    }

    private async refreshPlaylistSummary(
        playlistId: string,
        cancelledForRateLimit = false,
    ): Promise<void> {
        const transcriptions = await prisma.transcription.findMany({
            where: { playlistId },
            select: { status: true, wordCount: true },
        })

        const summary = summarizePlaylist(
            transcriptions,
            cancelledForRateLimit,
        )

        await prisma.playlist.update({
            where: { id: playlistId },
            data: {
                status: summary.status,
                errorMessage: summary.errorMessage,
                totalWordCount: summary.totalWordCount,
                completedAt: summary.completedAt === 'now' ? new Date() : null,
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
                    select: { id: true, youtubeId: true, errorMessage: true },
                },
            },
        })

        for (const playlist of playlists) {
            if (processingPlaylists.has(playlist.id)) continue

            if (playlist.transcriptions.length === 0) {
                await this.refreshPlaylistSummary(playlist.id)
                continue
            }

            const plan = interruptedResumePlan(playlist.transcriptions)
            if (plan.action === 'cancel') {
                if (plan.blockedIds.length > 0) {
                    await prisma.transcription.updateMany({
                        where: { id: { in: plan.blockedIds } },
                        data: {
                            status: TranscriptionStatus.ERROR,
                            errorMessage: plan.blockedMessage,
                            completedAt: new Date(),
                        },
                    })
                }
                if (plan.pendingIds.length > 0) {
                    await prisma.transcription.updateMany({
                        where: { id: { in: plan.pendingIds } },
                        data: {
                            status: TranscriptionStatus.ERROR,
                            errorMessage: plan.pendingMessage,
                            completedAt: new Date(),
                        },
                    })
                }
                await this.refreshPlaylistSummary(
                    playlist.id,
                    plan.cancelledForRateLimit,
                )
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
                        errorMessage: true,
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
