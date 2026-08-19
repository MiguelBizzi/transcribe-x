import { apiFetch } from '../lib/api'
import { setTokens, clearTokens } from '../server/tokens-auth'

export interface User {
  id: string
  email: string
  name: string | null
  avatar?: string
  provider: string
  isActive: boolean
  emailVerified: boolean
  createdAt: string
  updatedAt: string
}

export interface AuthResponse {
  message: string
  accessToken: string
  user: User
}

export interface LoginData {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  name: string
}

export async function registerUser(data: RegisterData): Promise<AuthResponse> {
  const response = await apiFetch<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  })

  return response
}

export async function loginUser(data: LoginData): Promise<AuthResponse> {
  const response = await apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  })

  await setTokens(response.accessToken)

  return response
}

export async function getGoogleAuthUrl(): Promise<{ authUrl: string }> {
  return apiFetch<{ authUrl: string }>('/auth/google')
}

export async function handleGoogleCallback(
  code: string,
): Promise<AuthResponse> {
  const response = await apiFetch<AuthResponse>(
    `/auth/google/callback?code=${code}`,
  )

  await setTokens(response.accessToken)

  return response
}

export async function getMe(): Promise<User> {
  return apiFetch<User>('/auth/me')
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/auth/logout', { method: 'GET' })
  } catch (error) {
    console.warn('Server logout failed, continuing with local cleanup:', error)
  } finally {
    await clearTokens()
  }
}
