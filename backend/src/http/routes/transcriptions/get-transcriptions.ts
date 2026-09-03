import { prisma } from '@/lib/prisma'
import { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from '@fastify/type-provider-zod'
import { z } from 'zod'
import { getCurrentUser } from '../../middlewares/auth'

export async function getTranscriptions(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().get(
        '/',
        {
            schema: {
                tags: ['Transcriptions'],
                summary: 'Get all transcriptions of the current user',
                security: [{ bearerAuth: [] }],
                response: {
                    200: z.object({
                        transcriptions: z.array(
                            z.object({
                                id: z.string(),
                                youtubeId: z.string(),
                                title: z.string(),
                                type: z.string(),
                                thumbnail: z.string().nullable(),
                                status: z.string(),
                                duration: z.number().nullable(),
                                wordCount: z.number().nullable(),
                                language: z.string().nullable(),
                                timestamps: z
                                    .array(
                                        z.object({
                                            text: z.string(),
                                            start: z.number(),
                                            duration: z.number(),
                                        }),
                                    )
                                    .nullable(),
                                createdAt: z.string(),
                                updatedAt: z.string(),
                                playlistId: z.string().nullable(),
                                isPlaylistVideo: z.boolean(),
                                videoIndex: z.number().nullable(),
                                playlist: z
                                    .object({
                                        id: z.string(),
                                        title: z.string(),
                                        thumbnail: z.string().nullable(),
                                        videoCount: z.number(),
                                        status: z.string(),
                                    })
                                    .nullable(),
                            }),
                        ),
                        total: z.number(),
                    }),
                    401: z.object({
                        message: z.string(),
                    }),
                },
            },
        },
        async (request, reply) => {
            const currentUser = getCurrentUser(request)

            const transcriptions = await prisma.transcription.findMany({
                where: { userId: currentUser.id },
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    youtubeId: true,
                    title: true,
                    type: true,
                    thumbnail: true,
                    status: true,
                    duration: true,
                    wordCount: true,
                    language: true,
                    timestamps: true,
                    createdAt: true,
                    updatedAt: true,
                    playlistId: true,
                    isPlaylistVideo: true,
                    videoIndex: true,
                    playlist: {
                        select: {
                            id: true,
                            title: true,
                            thumbnail: true,
                            videoCount: true,
                            status: true,
                        },
                    },
                },
            })

            reply.send({
                transcriptions: transcriptions.map((transcription) => ({
                    id: transcription.id,
                    youtubeId: transcription.youtubeId,
                    title: transcription.title,
                    type: transcription.type,
                    thumbnail: transcription.thumbnail,
                    status: transcription.status,
                    duration: transcription.duration,
                    wordCount: transcription.wordCount,
                    language: transcription.language,
                    timestamps: transcription.timestamps as any,
                    createdAt: transcription.createdAt.toISOString(),
                    updatedAt: transcription.updatedAt.toISOString(),
                    playlistId: transcription.playlistId,
                    isPlaylistVideo: transcription.isPlaylistVideo,
                    videoIndex: transcription.videoIndex,
                    playlist: transcription.playlist,
                })),
                total: transcriptions.length,
            })
        },
    )
}
