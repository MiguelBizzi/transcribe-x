import { getCookie, deleteCookie } from 'cookies-next'
import { apiConfig } from './env'
import { ACCESS_TOKEN_KEY } from '@/constants/cookies-names'
import { getAuthTokens } from '@/server/tokens-auth'

export interface ApiErrorResponse {
  message: string
  status: number
  code?: string
}

export class ApiError extends Error {
  public status: number
  public code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = 'An error occurred'
    let errorCode: string | undefined

    try {
      const errorData = await response.json()
      errorMessage = errorData.message || errorMessage
      errorCode = errorData.code
    } catch {
      errorMessage = response.statusText || errorMessage
    }

    throw new ApiError(errorMessage, response.status, errorCode)
  }

  if (
    response.status === 204 ||
    response.headers.get('content-length') === '0'
  ) {
    return {} as T
  }

  return response.json()
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${apiConfig.baseUrl}${endpoint}`
  const { accessToken } = await getAuthTokens()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (response.status === 401 && accessToken) {
      deleteCookie(ACCESS_TOKEN_KEY)

      if (typeof window !== 'undefined') {
        window.location.href = '/auth'
      }
      throw new ApiError('Authentication failed', 401)
    }

    return handleResponse<T>(response)
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    throw new ApiError(
      error instanceof Error ? error.message : 'Network error',
      500,
    )
  }
}

export function isAuthenticated(): boolean {
  return getCookie(ACCESS_TOKEN_KEY) !== null
}

export function getCurrentAccessToken(): string | null {
  return getCookie(ACCESS_TOKEN_KEY) as string | null
}
