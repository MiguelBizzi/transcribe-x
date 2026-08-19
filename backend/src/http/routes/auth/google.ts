import { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from '@fastify/type-provider-zod'
import { z } from 'zod'
import { googleOAuth2Client } from '@/lib/google-auth'

export async function googleAuth(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().get(
        '/google',
        {
            schema: {
                tags: ['Auth'],
                summary: 'Start Google OAuth flow',
                response: {
                    200: z.object({
                        authUrl: z.string(),
                    }),
                },
            },
        },
        async (request, reply) => {
            const state = `state_${Date.now()}`

            const googleAuthUrl = googleOAuth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: [
                    'https://www.googleapis.com/auth/userinfo.email',
                    'https://www.googleapis.com/auth/userinfo.profile',
                ],
                include_granted_scopes: true,
                state,
            })

            reply.send({
                authUrl: googleAuthUrl,
            })
        },
    )
}
