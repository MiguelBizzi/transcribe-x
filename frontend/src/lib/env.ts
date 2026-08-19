import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url(),
})

const parsedEnv = envSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
})

if (!parsedEnv.success) {
  console.log('Invalid env variables', parsedEnv.error.flatten().fieldErrors)

  throw new Error('Invalid env variables')
}

export const env = parsedEnv.data

export const config = {
  api: {
    baseUrl: env.NEXT_PUBLIC_API_URL,
  },
} as const

export const { api: apiConfig } = config
