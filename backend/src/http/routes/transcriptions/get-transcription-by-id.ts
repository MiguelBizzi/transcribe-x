import { prisma } from '@/lib/prisma'
import { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from '@fastify/type-provider-zod'
import { z } from 'zod'
import { getCurrentUser } from '../../middlewares/auth'
import { BadRequestError } from '../_errors/bad-request-error'
import { qualityMetricsSchema } from './quality-metrics-schema'

export async function getTranscriptionById(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().get(
        '/:id',
        {
            schema: {
                tags: ['Transcriptions'],
                summary: 'Get a specific transcription by ID',
                security: [{ bearerAuth: [] }],
                params: z.object({
                    id: z.string().uuid('Invalid transcription ID'),
                }),
                response: {
                    200: z.object({
                        transcription: z.object({
                            id: z.string(),
                            youtubeId: z.string(),
                            title: z.string(),
                            type: z.string(),
                            thumbnail: z.string().nullable(),
                            status: z.string(),
                            content: z.string().nullable(),
                            duration: z.number().nullable(),
                            wordCount: z.number().nullable(),
                            language: z.string().nullable(),
                            errorMessage: z.string().nullable(),
                            timestamps: z
                                .array(
                                    z.object({
                                        text: z.string(),
                                        start: z.number(),
                                        duration: z.number(),
                                    }),
                                )
                                .nullable(),
                            processedContent: z.string().nullable(),
                            qualityMetrics: qualityMetricsSchema.nullable(),
                            isProcessed: z.boolean(),
                            createdAt: z.string(),
                            updatedAt: z.string(),
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
            const currentUser = getCurrentUser(request)
            const { id } = request.params

            const transcription = await prisma.transcription.findFirst({
                where: {
                    id,
                    userId: currentUser.id,
                },
                select: {
                    id: true,
                    youtubeId: true,
                    title: true,
                    type: true,
                    thumbnail: true,
                    status: true,
                    content: true,
                    duration: true,
                    wordCount: true,
                    language: true,
                    errorMessage: true,
                    timestamps: true,
                    processedContent: true,
                    qualityMetrics: true,
                    isProcessed: true,
                    createdAt: true,
                    updatedAt: true,
                },
            })

            if (!transcription) {
                throw new BadRequestError('Transcription not found')
            }

            reply.send({
                transcription: {
                    id: transcription.id,
                    youtubeId: transcription.youtubeId,
                    title: transcription.title,
                    type: transcription.type,
                    thumbnail: transcription.thumbnail,
                    status: transcription.status,
                    content: transcription.content,
                    duration: transcription.duration,
                    wordCount: transcription.wordCount,
                    language: transcription.language,
                    errorMessage: transcription.errorMessage,
                    timestamps: transcription.timestamps as any,
                    processedContent: transcription.processedContent,
                    qualityMetrics:
                        (transcription.qualityMetrics as z.infer<
                            typeof qualityMetricsSchema
                        > | null) ?? null,
                    isProcessed: transcription.isProcessed,
                    createdAt: transcription.createdAt.toISOString(),
                    updatedAt: transcription.updatedAt.toISOString(),
                },
            })
        },
    )
}
