'use server'

import { actionClient } from '@/lib/safe-action'
import { loginSchema, registerSchema } from './schemas'
import { loginUser, registerUser } from '@/services/auth-service'
import { ApiError } from '@/lib/api'

export const loginAction = actionClient
  .inputSchema(loginSchema)
  .action(async ({ parsedInput: { email, password } }) => {
    try {
      const response = await loginUser({ email, password })

      return {
        success: true,
        message: response.message,
        user: response.user,
        accessToken: response.accessToken,
      }
    } catch (error) {
      let message = 'Ocorreu um erro ao fazer login'

      if (error instanceof ApiError) {
        if (error.status === 400) {
          message = error.message || 'Dados inválidos'
        } else if (error.status === 500) {
          message = 'Erro interno do servidor'
        }
      }

      return {
        success: false,
        message,
      }
    }
  })

export const registerAction = actionClient
  .inputSchema(registerSchema)
  .action(async ({ parsedInput: { email, password, name } }) => {
    try {
      const response = await registerUser({ email, password, name })

      return {
        success: true,
        message: response.message,
      }
    } catch (error) {
      let message = 'Erro ao criar conta'

      if (error instanceof ApiError) {
        if (error.status === 400) {
          message = error.message || 'Dados inválidos'
        } else if (error.status === 500) {
          message = 'Erro interno do servidor'
        }
      }

      return {
        success: false,
        message,
      }
    }
  })
