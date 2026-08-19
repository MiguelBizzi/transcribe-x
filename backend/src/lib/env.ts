import { z } from 'zod'
import dotenv from 'dotenv'

dotenv.config()

const envSchema = z.object({
    NODE_ENV: z
        .enum(['development', 'production', 'test'])
        .default('development'),
    JWT_SECRET: z.string(),
    SERVER_PORT: z
        .string()
        .regex(/^\d+$/, 'SERVER_PORT must be a number')
        .transform(Number),
    DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
    FRONTEND_URL: z.string().url(),
    // Google OAuth
    GOOGLE_CLIENT_ID: z.string(),
    GOOGLE_CLIENT_SECRET: z.string(),
    GOOGLE_REDIRECT_URI: z.string().url(),
    // YouTube API
    YOUTUBE_API_KEY: z.string(),
    // JWT Configuration
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
})

const envData = envSchema.safeParse(process.env)

if (!envData.success) {
    console.error(
        '❌ Invalid environment variables:',
        envData.error.flatten().fieldErrors,
    )
    process.exit(1)
}

export const env = envData.data
