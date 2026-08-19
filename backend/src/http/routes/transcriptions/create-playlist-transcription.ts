import { prisma } from '@/lib/prisma'
import { playlistTranscriptionService } from '@/services/playlist-transcription-service'
import { youtubeService } from '@/services/youtube-service'
import { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from '@fastify/type-provider-zod'
import { z } from 'zod'
import { BadRequestError } from '../_errors/bad-request-error'
import { getCurrentUser } from '../../middlewares/auth'

export async function createPlaylistTranscription(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().post(
        '/playlist',
        {
            schema: {
                tags: ['Transcriptions'],
                summary: 'Create a new playlist transcription',
                security: [{ bearerAuth: [] }],
                body: z.object({
                    playlistUrl: z.string().url('Invalid playlist URL'),
                }),
                response: {
                    201: z.object({
                        message: z.string(),
                        playlist: z.object({
                            id: z.string(),
                            youtubeId: z.string(),
                            title: z.string(),
                            videoCount: z.number(),
                            status: z.string(),
                            totalDuration: z.number().nullable(),
                            totalWordCount: z.number().nullable(),
                            createdAt: z.string(),
                        }),
                        result: z.object({
                            totalVideos: z.number(),
                            processedVideos: z.number(),
                            failedVideos: z.number(),
                        }),
                    }),
                    400: z.object({
                        message: z.string(),
                    }),
                    401: z.object({
                        message: z.string(),
                    }),
                },
            },
        },
        async (request, reply) => {
            const { playlistUrl } = request.body
            const currentUser = getCurrentUser(request)
            const userId = currentUser.id

            if (!youtubeService.isPlaylistUrl(playlistUrl)) {
                throw new BadRequestError(
                    'Invalid YouTube playlist URL provided',
                )
            }

            try {
                const result =
                    await playlistTranscriptionService.createPlaylistTranscription(
                        userId,
                        playlistUrl,
                    )

                if (!result.success) {
                    throw new BadRequestError(
                        result.error ||
                            'Failed to create playlist transcription',
                    )
                }

                const playlist = await prisma.playlist.findUnique({
                    where: { id: result.playlistId },
                })

                if (!playlist) {
                    throw new BadRequestError(
                        'Failed to retrieve playlist data',
                    )
                }

                return reply.status(201).send({
                    message: 'Playlist transcription created successfully',
                    playlist: {
                        id: playlist.id,
                        youtubeId: playlist.youtubeId,
                        title: playlist.title,
                        videoCount: playlist.videoCount,
                        status: playlist.status,
                        totalDuration: playlist.totalDuration,
                        totalWordCount: playlist.totalWordCount,
                        createdAt: playlist.createdAt.toISOString(),
                    },
                    result: {
                        totalVideos: result.totalVideos,
                        processedVideos: result.processedVideos,
                        failedVideos: result.failedVideos,
                    },
                })
            } catch (error) {
                throw new BadRequestError(
                    error instanceof Error
                        ? error.message
                        : 'Failed to create playlist transcription',
                )
            }
        },
    )
}
