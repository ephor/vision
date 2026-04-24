import { createModule } from '@getvision/server'
import { z } from 'zod'

export const analyticsModule = createModule({ prefix: '/analytics' })
  .get(
    '/dashboard',
    ({ span }) =>
      span('analytics.aggregate', {}, () => ({
        totalUsers: 1250,
        totalOrders: 3420,
        revenue: 125430.5,
        topProducts: [
          { id: 'prod_1', name: 'Laptop', sales: 145 },
          { id: 'prod_2', name: 'Mouse', sales: 320 },
          { id: 'prod_3', name: 'Keyboard', sales: 210 },
        ],
      })),
    {
      query: z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }),
      response: z.object({
        totalUsers: z.number(),
        totalOrders: z.number(),
        revenue: z.number(),
        topProducts: z.array(
          z.object({ id: z.string(), name: z.string(), sales: z.number() })
        ),
      }),
    }
  )
  .post(
    '/track',
    ({ body, span }) => {
      return span(
        'analytics.track',
        { 'event.name': body.event, 'user.id': body.userId },
        () => {
          console.log('📊 Event tracked:', body.event, body.properties)
          return { tracked: true, timestamp: new Date().toISOString() }
        }
      )
    },
    {
      body: z.object({
        event: z.string().describe('Event name'),
        userId: z.string().optional().describe('User ID'),
        properties: z.record(z.string(), z.any()).optional(),
      }),
      response: z.object({
        tracked: z.boolean(),
        timestamp: z.string(),
      }),
    }
  )
