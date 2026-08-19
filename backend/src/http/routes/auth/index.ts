import { FastifyInstance } from 'fastify'
import { register } from './register'
import { login } from './login'
import { googleAuth } from './google'
import { googleCallback } from './google-callback'
import { logout } from './logout'
import { me } from './me'

export async function authRoutes(app: FastifyInstance) {
    app.register(register, { prefix: '/auth' })
    app.register(login, { prefix: '/auth' })
    app.register(googleAuth, { prefix: '/auth' })
    app.register(googleCallback, { prefix: '/auth' })
    app.register(logout, { prefix: '/auth' })
    app.register(me, { prefix: '/auth' })
}
