import { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from '@fastify/type-provider-zod'
import { z } from 'zod'
import { getCurrentUser } from '../../middlewares/auth'
import { BadRequestError } from '../_errors/bad-request-error'
import { textDedupService } from '@/services/text-dedup-service'

export async function deduplicateChannel(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().post(
        '/channels/:channelId/deduplicate',
        {
            schema: {
                tags: ['Transcriptions'],
                summary:
                    'Deduplicate transcriptions across a YouTube channel (exact + near-duplicate)',
                security: [{ bearerAuth: [] }],
                params: z.object({
                    channelId: z.string().min(1, 'Invalid channel ID'),
                }),
                response: {
                    200: z.object({
                        message: z.string(),
                        scope: z.literal('channel'),
                        keptCount: z.number(),
                        duplicateCount: z.number(),
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
                const result = await textDedupService.deduplicateChannel(
                    request.params.channelId,
                    currentUser.id,
                )

                reply.send({
                    message: 'Channel transcriptions deduplicated successfully',
                    scope: 'channel' as const,
                    keptCount: result.keptCount,
                    duplicateCount: result.duplicateCount,
                    stats: result.stats,
                })
            } catch (error) {
                throw new BadRequestError(
                    error instanceof Error
                        ? error.message
                        : 'Failed to deduplicate channel',
                )
            }
        },
    )
}
