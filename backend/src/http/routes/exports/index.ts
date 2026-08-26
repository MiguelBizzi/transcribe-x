import { FastifyInstance } from 'fastify'
import { exportFineTuning } from './export-fine-tuning'

export async function exportRoutes(app: FastifyInstance) {
    app.register(exportFineTuning, { prefix: '/exports' })
}
