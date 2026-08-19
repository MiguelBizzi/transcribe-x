import { prisma } from '@/lib/prisma'
import { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from '@fastify/type-provider-zod'
import { z } from 'zod'
import { getCurrentUser } from '../../middlewares/auth'
import { BadRequestError } from '../_errors/bad-request-error'
import { textQualityService } from '@/services/text-quality-service'
import { qualityMetricsSchema } from './quality-metrics-schema'

export async function processTranscription(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().post(
        '/:id/process',
        {
            schema: {
                tags: ['Transcriptions'],
                summary: 'Re-run post-processing on a transcription',
                security: [{ bearerAuth: [] }],
                params: z.object({
                    id: z.string().uuid('Invalid transcription ID'),
                }),
                response: {
                    200: z.object({
                        message: z.string(),
                        transcription: z.object({
                            id: z.string(),
                            processedContent: z.string().nullable(),
                            qualityMetrics: qualityMetricsSchema.nullable(),
                            isProcessed: z.boolean(),
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
                    content: true,
                    language: true,
                },
            })

            if (!transcription) {
                throw new BadRequestError('Transcription not found')
            }

            if (!transcription.content?.trim()) {
                throw new BadRequestError(
                    'Transcription has no content to process',
                )
            }

            const result = await textQualityService.processAndPersist(
                transcription.id,
                transcription.content,
                transcription.language,
                true,
            )

            if (!result) {
                throw new BadRequestError(
                    'Failed to process transcription. Please try again later.',
                )
            }

            reply.send({
                message: 'Transcription processed successfully',
                transcription: {
                    id: transcription.id,
                    processedContent: result.processedText,
                    qualityMetrics: result.qualityMetrics,
                    isProcessed: true,
                },
            })
        },
    )
}
