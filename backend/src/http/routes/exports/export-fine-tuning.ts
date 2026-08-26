import { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from '@fastify/type-provider-zod'
import { z } from 'zod'
import { getCurrentUser } from '../../middlewares/auth'
import { BadRequestError } from '../_errors/bad-request-error'
import { fineTuningExportService } from '@/services/fine-tuning-export-service'

export async function exportFineTuning(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().get(
        '/fine-tuning',
        {
            schema: {
                tags: ['Exports'],
                summary:
                    'Export raw, processed, or curated transcriptions for fine-tuning',
                security: [{ bearerAuth: [] }],
                querystring: z.object({
                    scope: z.enum(['playlist', 'user']).default('user'),
                    playlistId: z.string().uuid().optional(),
                    dataset: z
                        .enum(['raw', 'processed', 'curated'])
                        .default('curated'),
                    format: z.enum(['jsonl', 'csv', 'json']).default('jsonl'),
                    includeDuplicates: z.enum(['true', 'false']).default('false'),
                }),
                response: {
                    200: z.object({
                        filename: z.string(),
                        mimeType: z.string(),
                        recordCount: z.number(),
                        skippedDuplicates: z.number(),
                        skippedDiscarded: z.number(),
                        content: z.string(),
                    }),
                    400: z.object({ message: z.string() }),
                    401: z.object({ message: z.string() }),
                },
            },
        },
        async (request, reply) => {
            const currentUser = getCurrentUser(request)
            const {
                scope,
                playlistId,
                dataset,
                format,
                includeDuplicates,
            } = request.query

            try {
                const result = await fineTuningExportService.export({
                    userId: currentUser.id,
                    scope,
                    playlistId,
                    dataset,
                    format,
                    includeDuplicates: includeDuplicates === 'true',
                })

                reply.send(result)
            } catch (error) {
                throw new BadRequestError(
                    error instanceof Error
                        ? error.message
                        : 'Failed to export fine-tuning dataset',
                )
            }
        },
    )
}
