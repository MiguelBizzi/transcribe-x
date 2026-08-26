import { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from '@fastify/type-provider-zod'
import { z } from 'zod'
import { getCurrentUser } from '../../middlewares/auth'
import { BadRequestError } from '../_errors/bad-request-error'
import { textDedupService } from '@/services/text-dedup-service'

const dedupStatsSchema = z.object({
    inputCount: z.number(),
    comparedCount: z.number(),
    exactDuplicateCount: z.number(),
    nearDuplicateCount: z.number(),
    keptCount: z.number(),
    groupCount: z.number(),
})

export async function deduplicatePlaylist(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().post(
        '/playlists/:id/deduplicate',
        {
            schema: {
                tags: ['Transcriptions'],
                summary:
                    'Deduplicate transcriptions within a playlist (exact + near-duplicate)',
                security: [{ bearerAuth: [] }],
                params: z.object({
                    id: z.string().uuid('Invalid playlist ID'),
                }),
                response: {
                    200: z.object({
                        message: z.string(),
                        scope: z.literal('playlist'),
                        keptCount: z.number(),
                        duplicateCount: z.number(),
                        stats: dedupStatsSchema,
                    }),
                    400: z.object({ message: z.string() }),
                    401: z.object({ message: z.string() }),
                },
            },
        },
        async (request, reply) => {
            const currentUser = getCurrentUser(request)

            try {
                const result = await textDedupService.deduplicatePlaylist(
                    request.params.id,
                    currentUser.id,
                )

                reply.send({
                    message: 'Playlist deduplicated successfully',
                    scope: 'playlist' as const,
                    keptCount: result.keptCount,
                    duplicateCount: result.duplicateCount,
                    stats: result.stats,
                })
            } catch (error) {
                throw new BadRequestError(
                    error instanceof Error
                        ? error.message
                        : 'Failed to deduplicate playlist',
                )
            }
        },
    )
}
