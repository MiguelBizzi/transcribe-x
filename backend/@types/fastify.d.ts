import 'fastify'

declare module 'fastify' {
    export interface FastifyRequest {
        getCurrentUserId(): Promise<string>
        user?: {
            id: string
            email: string
            name?: string
            provider: string
        }
    }
}
