import { Vision } from '@getvision/server'
import { z } from 'zod'

// GET /analytics/dashboard - Get analytics overview
const app = new Vision()

app.service('analytics')
  .endpoint(
    'GET',
    '/',
    {
      input: z.object({}),
      output: z.object({
        totalUsers: z.number(),
        totalOrders: z.number(),
        revenue: z.number(),
        topProducts: z.array(z.object({
          id: z.string(),
          name: z.string(),
          sales: z.number(),
        })),
      }),
    },
    async (_, c) => {
      const stats = c.span('analytics.aggregate', {}, () => ({
        totalUsers: 1250,
        totalOrders: 3420,
        revenue: 125430.5,
        topProducts: [
          { id: 'prod_1', name: 'Laptop', sales: 145 },
          { id: 'prod_2', name: 'Mouse', sales: 320 },
          { id: 'prod_3', name: 'Keyboard', sales: 210 },
        ],
      }))
      return stats
    }
  )

export default app
