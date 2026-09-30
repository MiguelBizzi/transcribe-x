import { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from '@fastify/type-provider-zod'
import { z } from 'zod'
import { getCurrentUser } from '../../middlewares/auth'
import { BadRequestError } from '../_errors/bad-request-error'
import { llmCurationService } from '@/services/llm-curation-service'

export async function curatePlaylist(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().post(
        '/playlists/:id/curate',
        {
            schema: {
                tags: ['Transcriptions'],
                summary: 'Run LLM curation on pending kept videos of a playlist',
                security: [{ bearerAuth: [] }],
                params: z.object({
                    id: z.string().uuid('Invalid playlist ID'),
                }),
                response: {
                    200: z.object({
                        message: z.string(),
                        curated: z.number(),
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
                const result = await llmCurationService.curatePlaylist(
                    request.params.id,
                    currentUser.id,
                )

                reply.send({
                    message: 'Playlist curation finished',
                    ...result,
                })
            } catch (error) {
                throw new BadRequestError(
                    error instanceof Error
                        ? error.message
                        : 'Failed to curate playlist',
                )
            }
        },
    )
}
