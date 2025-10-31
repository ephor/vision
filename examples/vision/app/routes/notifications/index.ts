import { Vision } from '@getvision/server'
import { z } from 'zod'

// POST /notifications - Send a notification
const app = new Vision()

app.service('notifications')
  .endpoint(
    'POST',
    '/',
    {
      input: z.object({
        userId: z.string().describe('User ID'),
        type: z.enum(['email', 'sms', 'push']).describe('Notification type'),
        message: z.string().min(1).describe('Notification message'),
      }),
      output: z.object({
        id: z.string(),
        status: z.enum(['sent', 'pending', 'failed']),
        sentAt: z.string(),
      }),
    },
    async (data, c) => {
      const notification = await c.span('notification.send', {
        'notification.type': data.type,
        'user.id': data.userId,
      }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 100))
        return {
          id: `notif_${Date.now()}`,
          status: 'sent' as const,
          sentAt: new Date().toISOString(),
        }
      })
      console.log(`📧 Notification sent to user ${data.userId}`)
      return notification
    }
  )

export default app
