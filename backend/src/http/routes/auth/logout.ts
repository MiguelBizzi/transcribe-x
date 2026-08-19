import { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from '@fastify/type-provider-zod'
import { z } from 'zod'
import { getCurrentUser } from '../../middlewares/auth'
import { prisma } from '@/lib/prisma'
import { tokenBlacklist } from '@/services/token-blacklist-service'

export async function logout(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().get(
        '/logout',
        {
            schema: {
                tags: ['Auth'],
                summary: 'User logout',
                description: 'Logout user and invalidate current session',
                security: [{ bearerAuth: [] }],
                response: {
                    200: z.object({
                        message: z.string(),
                        logoutTime: z.string(),
                        tokenBlacklisted: z.boolean(),
                    }),
                    401: z.object({
                        message: z.string(),
                    }),
                },
            },
        },
        async (request, reply) => {
            const user = getCurrentUser(request)
            const authHeader = request.headers.authorization
            const accessToken = authHeader?.substring(7)

            try {
                await prisma.recentActivity.create({
                    data: {
                        userId: user.id,
                        action: 'LOGOUT',
                        description: `User ${user.email} logged out`,
                        metadata: {
                            logoutTime: new Date().toISOString(),
                            userAgent:
                                request.headers['user-agent'] || 'unknown',
                            ipAddress: request.ip || 'unknown',
                        },
                    },
                })

                let tokenBlacklisted = false

                if (accessToken) {
                    try {
                        const tokenParts = accessToken.split('.')
                        if (tokenParts.length === 3) {
                            const payload = JSON.parse(
                                Buffer.from(tokenParts[1], 'base64').toString(),
                            )
                            const expiresAt = new Date(payload.exp * 1000)

                            await tokenBlacklist.blacklistToken(
                                accessToken,
                                user.id,
                                expiresAt,
                                'logout',
                            )
                            tokenBlacklisted = true
                        }
                    } catch (error) {
                        console.error('Error blacklisting access token:', error)
                    }
                }

                reply.send({
                    message: 'Logout successful',
                    logoutTime: new Date().toISOString(),
                    tokenBlacklisted,
                })
            } catch (error) {
                console.error('Error during logout:', error)

                reply.send({
                    message: 'Logout successful',
                    logoutTime: new Date().toISOString(),
                    tokenBlacklisted: false,
                })
            }
        },
    )
}
