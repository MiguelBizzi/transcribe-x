import { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from '@fastify/type-provider-zod'
import { z } from 'zod'
import { getCurrentUser } from '../../middlewares/auth'
import { BadRequestError } from '../_errors/bad-request-error'
import { textDedupService } from '@/services/text-dedup-service'

export async function deduplicateTranscription(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().post(
        '/:id/deduplicate',
        {
            schema: {
                tags: ['Transcriptions'],
                summary:
                    'Remove exact and near-duplicate sentences inside a transcription',
                security: [{ bearerAuth: [] }],
                params: z.object({
                    id: z.string().uuid('Invalid transcription ID'),
                }),
                response: {
                    200: z.object({
                        message: z.string(),
                        scope: z.literal('video'),
                        sentencesRemoved: z.number(),
                        stats: z.object({
                            inputCount: z.number(),
                            comparedCount: z.number(),
                            exactDuplicateCount: z.number(),
                            nearDuplicateCount: z.number(),
                            keptCount: z.number(),
                            groupCount: z.number(),
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
                const result = await textDedupService.deduplicateVideo(
                    request.params.id,
                    currentUser.id,
                )

                reply.send({
                    message: 'Transcription segments deduplicated successfully',
                    scope: 'video' as const,
                    sentencesRemoved: result.sentencesRemoved ?? 0,
                    stats: result.stats,
                })
            } catch (error) {
                throw new BadRequestError(
                    error instanceof Error
                        ? error.message
                        : 'Failed to deduplicate transcription',
                )
            }
        },
    )
}
