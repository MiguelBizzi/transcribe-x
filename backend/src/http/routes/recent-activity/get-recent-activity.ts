import { prisma } from '@/lib/prisma'
import { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from '@fastify/type-provider-zod'
import { z } from 'zod'
import { getCurrentUser } from '../../middlewares/auth'

export async function getRecentActivity(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().get(
        '/',
        {
            schema: {
                tags: ['Recent Activity'],
                summary: 'Get recent activity of the current user',
                security: [{ bearerAuth: [] }],
                response: {
                    200: z.object({
                        activities: z.array(
                            z.object({
                                id: z.string(),
                                action: z.enum(['LOGOUT']),
                                description: z.string(),
                                metadata: z.any().nullable(),
                                createdAt: z.string(),
                            }),
                        ),
                    }),
                    401: z.object({
                        message: z.string(),
                    }),
                },
            },
        },
        async (request, reply) => {
            const currentUser = getCurrentUser(request)

            const activities = await prisma.recentActivity.findMany({
                where: { userId: currentUser.id },
                orderBy: { createdAt: 'desc' },
            })

            reply.send({
                activities: activities.map((activity) => ({
                    id: activity.id,
                    action: activity.action as any,
                    description: activity.description,
                    metadata: activity.metadata,
                    createdAt: activity.createdAt.toISOString(),
                })),
            })
        },
    )
}
