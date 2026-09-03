import { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from '@fastify/type-provider-zod'
import { z } from 'zod'
import { getCurrentUser } from '../../middlewares/auth'
import { BadRequestError } from '../_errors/bad-request-error'
import { llmRewriteService } from '@/services/llm-rewrite-service'
import { rewriteDataSchema, qualityMetricsSchema, llmCurationDataSchema } from './quality-metrics-schema'

export async function rewriteTranscription(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().post(
        '/:id/rewrite',
        {
            schema: {
                tags: ['Transcriptions'],
                summary:
                    'Rewrite a curated transcription (WRAP: pretraining prose or SFT pairs)',
                security: [{ bearerAuth: [] }],
                params: z.object({
                    id: z.string().uuid('Invalid transcription ID'),
                }),
                body: z.object({
                    mode: z.enum(['pretraining', 'sft']).default('pretraining'),
                }),
                response: {
                    200: z.object({
                        message: z.string(),
                        transcription: z.object({
                            id: z.string(),
                            rewrittenContent: z.string(),
                            rewriteMode: z.enum(['pretraining', 'sft']),
                            rewriteData: rewriteDataSchema,
                            rewrittenQualityMetrics:
                                qualityMetricsSchema.nullable(),
                            rewrittenLlmCurationScore: z.number().nullable(),
                            rewrittenLlmCurationData:
                                llmCurationDataSchema.nullable(),
                        }),
                    }),
                    400: z.object({ message: z.string() }),
                    401: z.object({ message: z.string() }),
                },
            },
        },
        async (request, reply) => {
            const currentUser = getCurrentUser(request)

            try {
                const result = await llmRewriteService.rewriteTranscription(
                    request.params.id,
                    currentUser.id,
                    request.body.mode,
                )

                reply.send({
                    message: 'Transcription rewritten successfully',
                    transcription: {
                        id: result.transcriptionId,
                        rewrittenContent: result.rewrittenContent,
                        rewriteMode: result.rewriteMode,
                        rewriteData: result.rewriteData,
                        rewrittenQualityMetrics:
                            result.rewrittenQualityMetrics,
                        rewrittenLlmCurationScore:
                            result.rewrittenLlmCurationScore,
                        rewrittenLlmCurationData:
                            result.rewrittenLlmCurationData,
                    },
                })
            } catch (error) {
                throw new BadRequestError(
                    error instanceof Error
                        ? error.message
                        : 'Failed to rewrite transcription',
                )
            }
        },
    )
}
