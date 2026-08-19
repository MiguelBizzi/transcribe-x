import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '@/lib/prisma'
import { UnauthorizedError } from '../routes/_errors/unauthorized-error'
import fastifyPlugin from 'fastify-plugin'
import { tokenBlacklist } from '@/services/token-blacklist-service'

async function auth(app: FastifyInstance) {
    app.addHook(
        'preHandler',
        async (request: FastifyRequest, _reply: FastifyReply) => {
            try {
                if (
                    request.routeOptions.url === '/auth/login' ||
                    request.routeOptions.url === '/auth/register' ||
                    request.routeOptions.url === '/auth/google' ||
                    request.routeOptions.url === '/auth/google/callback'
                ) {
                    return
                }

                const authHeader = request.headers.authorization

                if (!authHeader || !authHeader.startsWith('Bearer ')) {
                    throw new UnauthorizedError(
                        'Missing or invalid authorization header',
                    )
                }

                const token = authHeader.substring(7)

                try {
                    const isBlacklisted =
                        await tokenBlacklist.isTokenBlacklisted(token)
                    if (isBlacklisted) {
                        throw new UnauthorizedError(
                            'Token has been invalidated',
                        )
                    }

                    const decoded = await request.jwtVerify<{
                        sub: string
                        email: string
                        provider: string
                        iat: number
                        exp: number
                    }>()

                    const now = Math.floor(Date.now() / 1000)
                    if (decoded.exp && decoded.exp < now) {
                        throw new UnauthorizedError('Token has expired')
                    }

                    const user = await prisma.user.findUnique({
                        where: { id: decoded.sub },
                        select: {
                            id: true,
                            email: true,
                            name: true,
                            provider: true,
                            isActive: true,
                        },
                    })

                    if (!user || !user.isActive) {
                        throw new UnauthorizedError(
                            'User not found or inactive',
                        )
                    }

                    request.user = {
                        id: user.id,
                        email: user.email,
                        name: user.name || undefined,
                        provider: user.provider,
                    }
                } catch (error) {
                    if (error instanceof UnauthorizedError) {
                        throw error
                    }
                    throw new UnauthorizedError('Invalid or expired token')
                }
            } catch (error) {
                if (error instanceof UnauthorizedError) {
                    throw error
                }
                throw new UnauthorizedError('Authentication failed')
            }
        },
    )
}

export { auth }
export default fastifyPlugin(auth)

export function getCurrentUser(request: FastifyRequest): {
    id: string
    email: string
    name?: string
    provider: string
} {
    if (!request.user) {
        throw new UnauthorizedError('User not authenticated')
    }
    return request.user as {
        id: string
        email: string
        name?: string
        provider: string
    }
}
