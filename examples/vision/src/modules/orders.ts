import { createModule, defineEvents } from '@getvision/server'
import { z } from 'zod'

const OrderPlaced = z.object({
  orderId: z.string(),
  userId: z.string(),
  total: z.number(),
})

export const ordersModule = createModule({ prefix: '/orders' })
  .use(
    defineEvents({
      'order/placed': {
        schema: OrderPlaced,
        description: 'Order placed',
        icon: '📦',
        tags: ['order', 'payment'],
        handler: async (event) => {
          console.log('📦 Processing order:', event.orderId)
        },
      },
    })
  )
  .post(
    '/',
    async ({ body, emit, span }) => {
      const orderId = Math.random().toString(36).substring(7)

      span('db.insert', { 'db.system': 'postgresql', 'db.table': 'orders' }, () => {
        sleep(40)
      })

      await emit('order/placed', {
        orderId,
        userId: body.userId,
        total: body.total,
      })

      return { orderId, status: 'pending' as const, total: body.total }
    },
    {
      body: z.object({
        userId: z.string(),
        items: z.array(
          z.object({
            productId: z.string(),
            quantity: z.number().int().positive(),
          })
        ),
        total: z.number().positive(),
      }),
      response: z.object({
        orderId: z.string(),
        status: z.string(),
        total: z.number(),
      }),
    }
  )

function sleep(ms: number) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    /* busy wait for demo */
  }
}
