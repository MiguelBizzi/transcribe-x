import { prisma } from '@/lib/prisma'
import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import type { ZodTypeProvider } from '@fastify/type-provider-zod'
import { z } from 'zod'
import { BadRequestError } from '../_errors/bad-request-error'
import { env } from '@/lib/env'

export async function login(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().post(
        '/login',
        {
            schema: {
                tags: ['Auth'],
                summary: 'User login',
                body: z.object({
                    email: z.string().email('Invalid email format'),
                    password: z.string().min(1, 'Password is required'),
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
                    401: z.object({
                        message: z.string(),
                    }),
                },
            },
        },
        async (request, reply) => {
            const { email, password } = request.body

            const user = await prisma.user.findUnique({
                where: { email },
            })

            if (!user) {
                throw new BadRequestError('Invalid email or password')
            }

            if (!user.isActive) {
                throw new BadRequestError('Account is deactivated')
            }

            if (user.provider !== 'CREDENTIALS') {
                throw new BadRequestError(
                    `Please login using ${user.provider.toLowerCase()}`,
                )
            }

            if (!user.passwordHash) {
                throw new BadRequestError('Invalid email or password')
            }

            const isPasswordValid = await bcrypt.compare(
                password,
                user.passwordHash,
            )
            if (!isPasswordValid) {
                throw new BadRequestError('Invalid email or password')
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
                message: 'Login successful',
                accessToken,
                user: userResponse,
            })
        },
    )
}
