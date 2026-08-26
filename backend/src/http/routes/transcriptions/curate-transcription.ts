import { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from '@fastify/type-provider-zod'
import { z } from 'zod'
import { getCurrentUser } from '../../middlewares/auth'
import { BadRequestError } from '../_errors/bad-request-error'
import { llmCurationService } from '@/services/llm-curation-service'
import { llmCurationDataSchema } from './quality-metrics-schema'

export async function curateTranscription(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().post(
        '/:id/curate',
        {
            schema: {
                tags: ['Transcriptions'],
                summary: 'Run LLM-assisted curation on a transcription',
                security: [{ bearerAuth: [] }],
                params: z.object({
                    id: z.string().uuid('Invalid transcription ID'),
                }),
                response: {
                    200: z.object({
                        message: z.string(),
                        transcription: z.object({
                            id: z.string(),
                            llmCurationScore: z.number(),
                            llmCurationData: llmCurationDataSchema,
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
                const result = await llmCurationService.curateTranscription(
                    request.params.id,
                    currentUser.id,
                )

                reply.send({
                    message: 'Transcription curated successfully',
                    transcription: {
                        id: result.transcriptionId,
                        llmCurationScore: result.llmCurationScore,
                        llmCurationData: result.llmCurationData,
                    },
                })
            } catch (error) {
                throw new BadRequestError(
                    error instanceof Error
                        ? error.message
                        : 'Failed to curate transcription',
                )
            }
        },
    )
}
