import { Vision } from '@getvision/server'
import { z } from 'zod'

// POST /products/create - Create a new product
const app = new Vision()

app.service('products')
  .endpoint(
    'POST',
    '/',
    {
      input: z.object({
        name: z.string().min(1).describe('Product name'),
        price: z.number().positive().describe('Product price'),
        description: z.string().optional().describe('Product description'),
      }),
      output: z.object({
        id: z.string(),
        name: z.string(),
        price: z.number(),
        createdAt: z.string(),
      }),
    },
    async (data, c) => {
      const product = c.span('db.insert', { 'db.table': 'products' }, () => {
        return {
          id: `prod_${Date.now()}`,
          name: data.name,
          price: data.price,
          createdAt: new Date().toISOString(),
        }
      })
      return product
    }
  )

export default app
