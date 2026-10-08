import { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from '@fastify/type-provider-zod'
import { z } from 'zod'
import { getCurrentUser } from '../../middlewares/auth'
import { BadRequestError } from '../_errors/bad-request-error'
import { playlistTranscriptionService } from '@/services/playlist-transcription-service'

export async function retryFailedPlaylist(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().post(
        '/playlists/:id/retry-failed',
        {
            schema: {
                tags: ['Transcriptions'],
                summary: 'Retry every failed video in a playlist',
                security: [{ bearerAuth: [] }],
                params: z.object({
                    id: z.string().uuid('Invalid playlist ID'),
                }),
                response: {
                    200: z.object({
                        message: z.string(),
                        playlistId: z.string(),
                        retried: z.number(),
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
            const result = await playlistTranscriptionService.startRetryFailed(
                request.params.id,
                currentUser.id,
            )

            if (result.outcome === 'not_found') {
                return reply.status(404).send({
                    message: 'Playlist não encontrada',
                })
            }

            if (result.outcome === 'rejected') {
                throw new BadRequestError(result.message)
            }

            return reply.send({
                message: 'Nova tentativa iniciada para os vídeos com erro',
                playlistId: request.params.id,
                retried: result.retried ?? 0,
            })
        },
    )
}
