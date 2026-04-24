import { createModule, defineEvents } from '@getvision/server'
import { z } from 'zod'

const Product = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  inStock: z.boolean(),
})

const ProductDetails = Product.extend({
  description: z.string(),
})

const ProductCreated = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  createdAt: z.string(),
})

const ProductViewed = z.object({
  userId: z.string().optional(),
  timestamp: z.number(),
})

export const productsModule = createModule({ prefix: '/products' })
  .use(
    defineEvents({
      'product/viewed': {
        schema: ProductViewed,
        description: 'Product viewed by user',
        icon: '👁',
        tags: ['analytics', 'product'],
        handler: async (event) => {
          console.log(
            '📊 Product viewed:',
            event.userId,
            'at',
            new Date(event.timestamp).toISOString()
          )
        },
      },
    })
  )
  .get(
    '/',
    async ({ span, emit }) => {
      const products = span('db.select', { 'db.table': 'products' }, () => [
        { id: 'prod_1', name: 'Laptop', price: 999.99, inStock: true },
        { id: 'prod_2', name: 'Mouse', price: 29.99, inStock: true },
        { id: 'prod_3', name: 'Keyboard', price: 79.99, inStock: false },
      ])
      await emit('product/viewed', { userId: 'user_123', timestamp: Date.now() })
      return { products }
    },
    {
      response: z.object({ products: z.array(Product) }),
    }
  )
  .get(
    '/:id',
    ({ params, span }) => {
      return span(
        'db.select',
        { 'db.table': 'products', 'product.id': params.id },
        () => ({
          id: params.id,
          name: 'Laptop',
          price: 999.99,
          inStock: true,
          description: 'High-performance laptop with 16GB RAM',
        })
      )
    },
    {
      params: z.object({ id: z.string() }),
      response: ProductDetails,
    }
  )
  .post(
    '/create',
    ({ body, span }) => {
      return span('db.insert', { 'db.table': 'products' }, () => ({
        id: `prod_${Date.now()}`,
        name: body.name,
        price: body.price,
        createdAt: new Date().toISOString(),
      }))
    },
    {
      body: z.object({
        name: z.string().min(1).describe('Product name'),
        price: z.number().positive().describe('Product price'),
        description: z.string().optional().describe('Product description'),
      }),
      response: ProductCreated,
    }
  )
