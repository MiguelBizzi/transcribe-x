import { playlistTranscriptionService } from '@/services/playlist-transcription-service'
import { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from '@fastify/type-provider-zod'
import { z } from 'zod'
import { getCurrentUser } from '../../middlewares/auth'

export async function getUserPlaylists(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().get(
        '/playlists',
        {
            schema: {
                tags: ['Transcriptions'],
                summary: 'Get user playlists',
                security: [{ bearerAuth: [] }],
                response: {
                    200: z.object({
                        playlists: z.array(
                            z.object({
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
                                        duration: z.number().nullable(),
                                        wordCount: z.number().nullable(),
                                        videoIndex: z.number().nullable(),
                                        createdAt: z.string(),
                                    }),
                                ),
                            }),
                        ),
                    }),
                    401: z.object({
                        message: z.string(),
                    }),
                },
            },
        },
        async (request, reply) => {
            const currentUser = getCurrentUser(request)
            const userId = currentUser.id

            try {
                const playlists =
                    await playlistTranscriptionService.getUserPlaylists(userId)

                return reply.send({
                    playlists: playlists.map((playlist) => ({
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
                            (transcription) => ({
                                id: transcription.id,
                                youtubeId: transcription.youtubeId,
                                title: transcription.title,
                                status: transcription.status,
                                duration: transcription.duration,
                                wordCount: transcription.wordCount,
                                videoIndex: transcription.videoIndex,
                                createdAt:
                                    transcription.createdAt.toISOString(),
                            }),
                        ),
                    })),
                })
            } catch (error) {
                throw new Error(
                    error instanceof Error
                        ? error.message
                        : 'Failed to fetch playlists',
                )
            }
        },
    )
}
