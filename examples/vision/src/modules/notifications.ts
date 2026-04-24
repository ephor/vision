import { createModule } from '@getvision/server'
import { z } from 'zod'

export const notificationsModule = createModule({ prefix: '/notifications' })
  .post(
    '/',
    async ({ body, span }) => {
      const notification = await span(
        'notification.send',
        { 'notification.type': body.type, 'user.id': body.userId },
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 100))
          return {
            id: `notif_${Date.now()}`,
            status: 'sent' as const,
            sentAt: new Date().toISOString(),
          }
        }
      )
      console.log(`📧 Notification sent to user ${body.userId}`)
      return notification
    },
    {
      body: z.object({
        userId: z.string().describe('User ID'),
        type: z.enum(['email', 'sms', 'push']).describe('Notification type'),
        message: z.string().min(1).describe('Notification message'),
      }),
      response: z.object({
        id: z.string(),
        status: z.enum(['sent', 'pending', 'failed']),
        sentAt: z.string(),
      }),
    }
  )
