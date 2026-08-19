'use server'

import { env } from '@/lib/env'
import { clearTokens, getAuthTokens } from './tokens-auth'
import type { User } from '@/services/auth-service'

export async function validateAuth(): Promise<
  { valid: false } | { valid: true; user: User }
> {
  const { accessToken } = await getAuthTokens()

  try {
    const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      return { valid: false }
    }

    const data = await response.json()

    return { valid: true, user: data.user }
  } catch {
    return { valid: false }
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const result = await validateAuth()

  if (!result.valid || !result.user) {
    return null
  }

  return result.user
}

export async function logout() {
  try {
    const { accessToken } = await getAuthTokens()

    if (accessToken) {
      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/auth/logout`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        console.warn('Logout request to database failed:', response.status)
      }
    }
  } catch (error) {
    console.error('Error during logout request:', error)
  }

  await clearTokens()

  return { success: true }
}
