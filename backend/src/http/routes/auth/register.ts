import { prisma } from '@/lib/prisma'
import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import type { ZodTypeProvider } from '@fastify/type-provider-zod'
import { z } from 'zod'
import { BadRequestError } from '../_errors/bad-request-error'

export async function register(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().post(
        '/register',
        {
            schema: {
                tags: ['Auth'],
                summary: 'User registration',
                body: z.object({
                    email: z.string().email('Invalid email format'),
                    password: z
                        .string()
                        .min(8, 'Password must be at least 8 characters'),
                    name: z
                        .string()
                        .min(2, 'Name must be at least 2 characters'),
                }),
                response: {
                    201: z.object({
                        message: z.string(),
                        user: z.object({
                            id: z.string(),
                            email: z.string(),
                            name: z.string(),
                            provider: z.string(),
                            createdAt: z.string(),
                        }),
                    }),
                    400: z.object({
                        message: z.string(),
                    }),
                },
            },
        },
        async (request, reply) => {
            const { email, password, name } = request.body

            const existingUser = await prisma.user.findUnique({
                where: { email },
            })

            if (existingUser) {
                throw new BadRequestError('User with this email already exists')
            }

            const saltRounds = 12
            const passwordHash = await bcrypt.hash(password, saltRounds)

            const user = await prisma.user.create({
                data: {
                    email,
                    name,
                    passwordHash,
                    provider: 'CREDENTIALS',
                    isActive: true,
                    emailVerified: false,
                },
            })

            const userResponse = {
                id: user.id,
                email: user.email,
                name: user.name || '',
                provider: user.provider,
                createdAt: user.createdAt.toISOString(),
            }

            reply.status(201).send({
                message: 'User registered successfully.',
                user: userResponse,
            })
        },
    )
}
