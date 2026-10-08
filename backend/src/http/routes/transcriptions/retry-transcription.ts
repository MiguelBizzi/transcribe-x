import { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from '@fastify/type-provider-zod'
import { z } from 'zod'
import { getCurrentUser } from '../../middlewares/auth'
import { BadRequestError } from '../_errors/bad-request-error'
import { playlistTranscriptionService } from '@/services/playlist-transcription-service'

export async function retryTranscription(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().post(
        '/:id/retry',
        {
            schema: {
                tags: ['Transcriptions'],
                summary: 'Retry a failed transcription',
                security: [{ bearerAuth: [] }],
                params: z.object({
                    id: z.string().uuid('Invalid transcription ID'),
                }),
                response: {
                    200: z.object({
                        message: z.string(),
                        transcriptionId: z.string(),
                        playlistId: z.string().nullable(),
                        status: z.string(),
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
            const result = await playlistTranscriptionService.startRetry(
                request.params.id,
                currentUser.id,
            )

            if (result.outcome === 'not_found') {
                return reply.status(404).send({
                    message: 'Transcrição não encontrada',
                })
            }

            if (result.outcome === 'rejected') {
                throw new BadRequestError(result.message)
            }

            return reply.send({
                message: 'Nova tentativa iniciada',
                transcriptionId: request.params.id,
                playlistId: result.playlistId ?? null,
                status: 'PROCESSING',
            })
        },
    )
}
