import { prisma } from '@/lib/prisma'
import { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from '@fastify/type-provider-zod'
import { z } from 'zod'
import { getCurrentUser } from '../../middlewares/auth'

export async function getLastTranscriptions(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().get(
        '/last',
        {
            schema: {
                tags: ['Transcriptions'],
                summary: 'Get the last 5 transcriptions of the current user',
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
                take: 5,
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
                },
            })

            const total = await prisma.transcription.count({
                where: { userId: currentUser.id },
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
                })),
                total,
            })
        },
    )
}
