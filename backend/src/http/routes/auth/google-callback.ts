import { prisma } from '@/lib/prisma'
import { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from '@fastify/type-provider-zod'
import { z } from 'zod'
import { BadRequestError } from '../_errors/bad-request-error'
import { env } from '@/lib/env'
import { googleOAuth2Client } from '@/lib/google-auth'
import { getDisplayName } from '@/utils/generate-name-from-email'

export async function googleCallback(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().get(
        '/google/callback',
        {
            schema: {
                tags: ['Auth'],
                summary: 'Handle Google OAuth callback',
                querystring: z.object({
                    code: z.string(),
                    state: z.string().optional(),
                }),
                response: {
                    200: z.object({
                        message: z.string(),
                        accessToken: z.string(),
                        user: z.object({
                            id: z.string(),
                            email: z.string(),
                            name: z.string().nullable(),
                            provider: z.string(),
                            isActive: z.boolean(),
                            emailVerified: z.boolean(),
                            createdAt: z.string(),
                        }),
                    }),
                    400: z.object({
                        message: z.string(),
                    }),
                    500: z.object({
                        message: z.string(),
                    }),
                },
            },
        },
        async (request, reply) => {
            const { code } = request.query

            if (!code) {
                throw new BadRequestError('Authorization code is required')
            }

            const { tokens } = await googleOAuth2Client.getToken(code)
            googleOAuth2Client.setCredentials(tokens)

            try {
                const userInfoResponse = await fetch(
                    'https://www.googleapis.com/oauth2/v2/userinfo',
                    {
                        headers: {
                            Authorization: `Bearer ${tokens.access_token}`,
                        },
                    },
                )

                if (!userInfoResponse.ok) {
                    throw new BadRequestError(
                        'Failed to fetch user information from Google',
                    )
                }

                const googleUser = await userInfoResponse.json()

                const { id: googleId, email, name, picture } = googleUser

                if (!email) {
                    throw new BadRequestError('Email is required from Google')
                }

                const displayName = name || getDisplayName(email)

                let user = await prisma.user.findUnique({
                    where: { email },
                })

                if (user) {
                    if (!user.googleId) {
                        user = await prisma.user.update({
                            where: { id: user.id },
                            data: {
                                googleId,
                                avatar: picture,
                                emailVerified: true,
                            },
                        })
                    }
                } else {
                    user = await prisma.user.create({
                        data: {
                            email,
                            name: displayName,
                            avatar: picture,
                            googleId,
                            provider: 'GOOGLE',
                            isActive: true,
                            emailVerified: true,
                        },
                    })
                }

                if (!app.jwt) {
                    throw new BadRequestError('JWT not configured')
                }

                const accessToken = app.jwt.sign(
                    {
                        sub: user.id,
                        email: user.email,
                        provider: user.provider,
                    },
                    {
                        expiresIn: env.JWT_ACCESS_EXPIRES_IN,
                    },
                )

                const userResponse = {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    provider: user.provider,
                    isActive: user.isActive,
                    emailVerified: user.emailVerified,
                    createdAt: user.createdAt.toISOString(),
                }

                reply.send({
                    message: 'Google authentication successful',
                    accessToken,
                    user: userResponse,
                })
            } catch (error) {
                console.error('Google OAuth error:', error)
                throw new BadRequestError('Google authentication failed')
            }
        },
    )
}
