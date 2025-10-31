import { Router } from 'express'
import { useVisionSpan } from '@getvision/adapter-express'

const router = Router()

// Mounted at /analytics -> GET /analytics/dashboard
router.get('/dashboard', (req, res) => {
  const withSpan = useVisionSpan()
  const analytics = withSpan('db.select', { 'db.system': 'postgresql', 'db.table': 'analytics' }, () => {
    return { id: 1, name: 'Analytics', description: 'Analytics dashboard' }
  })
  res.json({ analytics })
})

export default router
