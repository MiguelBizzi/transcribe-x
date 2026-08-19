import { FastifyInstance } from 'fastify'
import { getRecentActivity } from './get-recent-activity'

export async function recentActivityRoutes(app: FastifyInstance) {
    app.register(getRecentActivity, { prefix: '/recent-activity' })
}
