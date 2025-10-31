import { Vision } from '@getvision/server'
import { z } from 'zod'

// POST /analytics/track - Track an event
const app = new Vision()

app.service('analytics')
  .endpoint(
    'POST',
    '/',
    {
      input: z.object({
        event: z.string().describe('Event name'),
        userId: z.string().optional().describe('User ID'),
        properties: z.record(z.string(), z.any()).optional().describe('Event properties'),
      }),
      output: z.object({
        tracked: z.boolean(),
        timestamp: z.string(),
      }),
    },
    async (data, c) => {
      const result = c.span('analytics.track', {
        'event.name': data.event,
        'user.id': data.userId,
      }, () => {
        console.log('📊 Event tracked:', data.event, data.properties)
        return {
          tracked: true,
          timestamp: new Date().toISOString(),
        }
      })
      return result
    }
  )

export default app
