import { Vision } from '@getvision/server'
import { z } from 'zod'

// GET /products/:id - Get product by ID
const app = new Vision()

app.service('products')
  .endpoint(
    'GET',
    '/',
    {
      input: z.object({ id: z.string().describe('Product ID') }),
      output: z.object({
        id: z.string(),
        name: z.string(),
        price: z.number(),
        inStock: z.boolean(),
        description: z.string(),
      }),
    },
    async ({ id }, c) => {
      const product = c.span('db.select', {
        'db.table': 'products',
        'product.id': id,
      }, () => {
        return {
          id,
          name: 'Laptop',
          price: 999.99,
          inStock: true,
          description: 'High-performance laptop with 16GB RAM',
        }
      })
      return product
    }
  )

export default app
