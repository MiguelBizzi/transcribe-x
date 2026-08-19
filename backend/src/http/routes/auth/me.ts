import { prisma } from '@/lib/prisma'
import { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from '@fastify/type-provider-zod'
import { z } from 'zod'
import { getCurrentUser } from '../../middlewares/auth'

export async function me(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().get(
        '/me',
        {
            schema: {
                tags: ['Auth'],
                summary: 'Get current user information',
                security: [{ bearerAuth: [] }],
                response: {
                    200: z.object({
                        user: z.object({
                            id: z.string(),
                            email: z.string(),
                            name: z.string().nullable(),
                            avatar: z.string().nullable(),
                            provider: z.string(),
                            isActive: z.boolean(),
                            emailVerified: z.boolean(),
                            createdAt: z.string(),
                            updatedAt: z.string(),
                        }),
                    }),
                    401: z.object({
                        message: z.string(),
                    }),
                },
            },
        },
        async (request, reply) => {
            const currentUser = getCurrentUser(request)

            const user = await prisma.user.findUnique({
                where: { id: currentUser.id },
            })

            if (!user) {
                throw new Error('User not found')
            }

            const userResponse = {
                id: user.id,
                email: user.email,
                name: user.name,
                avatar: user.avatar,
                provider: user.provider,
                isActive: user.isActive,
                emailVerified: user.emailVerified,
                createdAt: user.createdAt.toISOString(),
                updatedAt: user.updatedAt.toISOString(),
            }

            reply.send({
                user: userResponse,
            })
        },
    )
}
