import type { FastifyInstance } from 'fastify'
import { useVisionSpan } from '@getvision/adapter-fastify'

async function analyticsPlugin(app: FastifyInstance) {
  // Mounted with prefix '/analytics' -> GET /analytics/dashboard
  app.get('/dashboard', async (request, reply) => {
    const withSpan = useVisionSpan()
    const analytics = withSpan('db.select', { 'db.system': 'postgresql', 'db.table': 'analytics' }, () => {
      return { id: 1, name: 'Analytics', description: 'Analytics dashboard' }
    })
    return { analytics }
  })
}

export default analyticsPlugin
