import { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from '@fastify/type-provider-zod'
import { z } from 'zod'
import { getCurrentUser } from '../../middlewares/auth'
import { BadRequestError } from '../_errors/bad-request-error'
import { llmRewriteService } from '@/services/llm-rewrite-service'

export async function rewritePlaylist(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().post(
        '/playlists/:id/rewrite',
        {
            schema: {
                tags: ['Transcriptions'],
                summary:
                    'WRAP-rewrite approved videos of a playlist (skips discard and duplicates)',
                security: [{ bearerAuth: [] }],
                params: z.object({
                    id: z.string().uuid('Invalid playlist ID'),
                }),
                body: z.object({
                    mode: z.enum(['pretraining', 'sft']).default('pretraining'),
                }),
                response: {
                    200: z.object({
                        message: z.string(),
                        rewritten: z.number(),
                        skipped: z.number(),
                        failed: z.number(),
                    }),
                    400: z.object({ message: z.string() }),
                    401: z.object({ message: z.string() }),
                },
            },
        },
        async (request, reply) => {
            const currentUser = getCurrentUser(request)

            try {
                const result = await llmRewriteService.rewritePlaylist(
                    request.params.id,
                    currentUser.id,
                    request.body.mode,
                )

                reply.send({
                    message: 'Playlist rewrite finished',
                    ...result,
                })
            } catch (error) {
                throw new BadRequestError(
                    error instanceof Error
                        ? error.message
                        : 'Failed to rewrite playlist',
                )
            }
        },
    )
}
