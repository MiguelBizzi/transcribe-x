'use server'

import { cookies } from 'next/headers'
import { ACCESS_TOKEN_KEY } from '@/constants/cookies-names'

export async function setTokens(accessToken: string) {
  const cookieStore = await cookies()

  cookieStore.set(ACCESS_TOKEN_KEY, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  })
}

export async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(ACCESS_TOKEN_KEY)?.value || null
}

export async function getAuthTokens(): Promise<{
  accessToken: string | null
}> {
  const accessToken = await getAccessToken()
  return { accessToken }
}

export async function clearTokens() {
  const cookieStore = await cookies()
  cookieStore.delete(ACCESS_TOKEN_KEY)
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getAccessToken()
  return token !== null
}
