import { Hono } from 'hono'
import { useVisionSpan } from '@getvision/adapter-hono'

const app = new Hono()
// Mounted at /analytics → this route becomes GET /analytics/dashboard
app.get('/dashboard', async (c) => {
  const withSpan = useVisionSpan()
  
  const analytics = withSpan('db.select', { 'db.system': 'sqlite', 'db.table': 'analytics' }, () => {
    return { id: 1, name: 'Analytics', description: 'Analytics dashboard' }
  })
  
  return c.json({ analytics })
})

export default app
