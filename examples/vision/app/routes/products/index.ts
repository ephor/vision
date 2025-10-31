import { Vision } from '@getvision/server'
import { z } from 'zod'

const app = new Vision()

app
  .service('products')
  .endpoint(
    'GET',
    '/',
    {
      input: z.object({}),
      output: z.object({
        products: z.array(z.object({
          id: z.string(),
          name: z.string(),
          price: z.number(),
          inStock: z.boolean(),
        })),
      }),
    },
    async (_, c) => {
      const products = c.span('db.select', { 'db.table': 'products' }, () => {
        return [
          { id: 'prod_1', name: 'Laptop', price: 999.99, inStock: true },
          { id: 'prod_2', name: 'Mouse', price: 29.99, inStock: true },
          { id: 'prod_3', name: 'Keyboard', price: 79.99, inStock: false },
        ]
      })
      return { products }
    }
  )

export default app
