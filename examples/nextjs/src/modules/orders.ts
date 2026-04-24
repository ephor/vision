import { createModule, defineEvents } from '@getvision/server'
import { z } from 'zod'

const OrderItem = z.object({
  productId: z.string(),
  qty: z.number().int().positive(),
})

const Order = z.object({
  id: z.string(),
  items: z.array(OrderItem),
  total: z.number(),
  createdAt: z.string(),
})

const OrderPlaced = z.object({
  orderId: z.string(),
  userId: z.string(),
  total: z.number(),
})

/**
 * `/orders` resource — pub/sub-heavy workflow.
 * Demonstrates colocation of route + event handler in the same module.
 */
export const ordersModule = createModule({ prefix: '/orders' })
  .use(
    defineEvents({
      'order/placed': {
        schema: OrderPlaced,
        description: 'New order placed — triggers fulfilment pipeline',
        icon: '📦',
        tags: ['order', 'commerce'],
        handler: async (event) => {
          console.log('[orders] 📦 processing', event.orderId, '$' + event.total)
        },
      },
    })
  )
  .post(
    '/',
    async ({ body, emit, span }) => {
      const orderId = `ord_${Date.now()}`
      const total = body.items.reduce((sum, it) => sum + it.qty * 10, 0)

      const order = span('db.insert', { 'db.table': 'orders' }, () => ({
        id: orderId,
        items: body.items,
        total,
        createdAt: new Date().toISOString(),
      }))

      await emit('order/placed', {
        orderId,
        userId: body.userId,
        total,
      })

      return order
    },
    {
      body: z.object({
        userId: z.string(),
        items: z.array(OrderItem).min(1),
      }),
      response: Order,
    }
  )
