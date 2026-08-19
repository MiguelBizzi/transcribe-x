import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'
import { env } from '@/lib/env'

const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
})

export const prisma = new PrismaClient({
    adapter,
    log: ['query'],
})
