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

const Review = z.object({
  id: z.string(),
  productId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string(),
})

const ProductViewed = z.object({
  productId: z.string(),
  timestamp: z.number(),
})

/**
 * `/products` resource — demonstrates nested sub-resources:
 *   GET  /products
 *   GET  /products/:id
 *   GET  /products/:id/reviews   ← sub-resource under dynamic param
 *   POST /products/:id/reviews   ← write into sub-resource
 */
export const productsModule = createModule({ prefix: '/products' })
  .use(
    defineEvents({
      'product/viewed': {
        schema: ProductViewed,
        description: 'Product detail page viewed',
        icon: '👁',
        tags: ['analytics', 'product'],
        handler: async (event) => {
          console.log('[products] 📊 viewed', event.productId)
        },
      },
    })
  )
  .get(
    '/',
    ({ span }) => {
      const products = span('db.select', { 'db.table': 'products' }, () => [
        { id: 'laptop', name: 'Laptop', price: 999.99, inStock: true },
        { id: 'mouse', name: 'Mouse', price: 29.99, inStock: true },
        { id: 'keyboard', name: 'Keyboard', price: 79.99, inStock: false },
      ])
      return { products }
    },
    { response: z.object({ products: z.array(Product) }) }
  )
  .get(
    '/:id',
    async ({ params, emit, span }) => {
      const product = span(
        'db.select',
        { 'db.table': 'products', 'product.id': params.id },
        () => ({
          id: params.id,
          name: 'Laptop',
          price: 999.99,
          inStock: true,
          description: '16GB RAM, 512GB SSD — dev-ready.',
        })
      )
      await emit('product/viewed', { productId: params.id, timestamp: Date.now() })
      return product
    },
    {
      params: z.object({ id: z.string() }),
      response: ProductDetails,
    }
  )
  .get(
    '/:id/reviews',
    ({ params, span }) => {
      const reviews = span(
        'db.select',
        { 'db.table': 'reviews', 'product.id': params.id },
        () => [
          { id: 'r1', productId: params.id, rating: 5, comment: 'Great!' },
          { id: 'r2', productId: params.id, rating: 4, comment: 'Solid.' },
        ]
      )
      return { reviews }
    },
    {
      params: z.object({ id: z.string() }),
      response: z.object({ reviews: z.array(Review) }),
    }
  )
  .post(
    '/:id/reviews',
    ({ params, body, span }) =>
      span('db.insert', { 'db.table': 'reviews', 'product.id': params.id }, () => ({
        id: `r_${Date.now()}`,
        productId: params.id,
        rating: body.rating,
        comment: body.comment,
      })),
    {
      params: z.object({ id: z.string() }),
      body: z.object({
        rating: z.number().min(1).max(5),
        comment: z.string().min(1),
      }),
      response: Review,
    }
  )
