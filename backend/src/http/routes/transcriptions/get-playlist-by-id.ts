import { playlistTranscriptionService } from '@/services/playlist-transcription-service'
import { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from '@fastify/type-provider-zod'
import { z } from 'zod'
import { getCurrentUser } from '../../middlewares/auth'
import { BadRequestError } from '../_errors/bad-request-error'
import { qualityMetricsSchema } from './quality-metrics-schema'

export async function getPlaylistById(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().get(
        '/playlists/:id',
        {
            schema: {
                tags: ['Transcriptions'],
                summary: 'Get playlist by ID with all transcriptions',
                security: [{ bearerAuth: [] }],
                params: z.object({
                    id: z.string().uuid('Invalid playlist ID'),
                }),
                response: {
                    200: z.object({
                        playlist: z.object({
                            id: z.string(),
                            youtubeId: z.string(),
                            title: z.string(),
                            description: z.string().nullable(),
                            channelTitle: z.string().nullable(),
                            thumbnail: z.string().nullable(),
                            videoCount: z.number(),
                            status: z.string(),
                            totalDuration: z.number().nullable(),
                            totalWordCount: z.number().nullable(),
                            createdAt: z.string(),
                            transcriptions: z.array(
                                z.object({
                                    id: z.string(),
                                    youtubeId: z.string(),
                                    title: z.string(),
                                    status: z.string(),
                                    content: z.string().nullable(),
                                    thumbnail: z.string().nullable(),
                                    duration: z.number().nullable(),
                                    wordCount: z.number().nullable(),
                                    language: z.string().nullable(),
                                    timestamps: z.any().nullable(),
                                    processedContent: z.string().nullable(),
                                    qualityMetrics:
                                        qualityMetricsSchema.nullable(),
                                    isProcessed: z.boolean(),
                                    llmCurationScore: z.number().nullable(),
                                    deduplicationStatus: z.string(),
                                    videoIndex: z.number().nullable(),
                                    createdAt: z.string(),
                                }),
                            ),
                        }),
                    }),
                    400: z.object({
                        message: z.string(),
                    }),
                    401: z.object({
                        message: z.string(),
                    }),
                    404: z.object({
                        message: z.string(),
                    }),
                },
            },
        },
        async (request, reply) => {
            const { id } = request.params
            const currentUser = getCurrentUser(request)
            const userId = currentUser.id

            try {
                const playlist =
                    await playlistTranscriptionService.getPlaylistById(
                        id,
                        userId,
                    )

                if (!playlist) {
                    return reply.status(404).send({
                        message: 'Playlist not found',
                    })
                }

                return reply.send({
                    playlist: {
                        id: playlist.id,
                        youtubeId: playlist.youtubeId,
                        title: playlist.title,
                        description: playlist.description,
                        channelTitle: playlist.channelTitle,
                        thumbnail: playlist.thumbnail,
                        videoCount: playlist.videoCount,
                        status: playlist.status,
                        totalDuration: playlist.totalDuration,
                        totalWordCount: playlist.totalWordCount,
                        createdAt: playlist.createdAt.toISOString(),
                        transcriptions: playlist.transcriptions.map(
                            (transcription: any) => ({
                                id: transcription.id,
                                youtubeId: transcription.youtubeId,
                                title: transcription.title,
                                status: transcription.status,
                                content: transcription.content,
                                thumbnail: transcription.thumbnail,
                                duration: transcription.duration,
                                wordCount: transcription.wordCount,
                                language: transcription.language,
                                timestamps: transcription.timestamps,
                                processedContent:
                                    transcription.processedContent,
                                qualityMetrics:
                                    (transcription.qualityMetrics as z.infer<
                                        typeof qualityMetricsSchema
                                    > | null) ?? null,
                                isProcessed: transcription.isProcessed,
                                llmCurationScore:
                                    transcription.llmCurationScore,
                                deduplicationStatus:
                                    transcription.deduplicationStatus,
                                videoIndex: transcription.videoIndex,
                                createdAt:
                                    transcription.createdAt.toISOString(),
                            }),
                        ),
                    },
                })
            } catch (error) {
                throw new BadRequestError(
                    error instanceof Error
                        ? error.message
                        : 'Failed to fetch playlist',
                )
            }
        },
    )
}
