/**
 * Vision React Query Client
 * Auto-generated type-safe API client from server routes
 */

import { createVisionClient, defineTypedRoutes } from '@getvision/react-query'
import { z } from 'zod'

// Define types (or import from server)
const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.string().datetime()
})

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email()
})

// Option 1: Auto-discovery from Vision Dashboard (runtime)
// import type { AppRouter } from '../server'
// export const api = createVisionClient<AppRouter>({
//   baseUrl: 'http://localhost:3000',
//   dashboardUrl: 'http://localhost:9500'
// })

// Option 2: Typed routes for compile-time type safety
export const routes = defineTypedRoutes({
  users: {
    list: {
      method: 'GET',
      path: '/users/list',
      input: z.object({ page: z.number(), limit: z.number() }),
      output: z.object({
        users: z.array(userSchema),
        page: z.number(),
        limit: z.number(),
        total: z.number()
      })
    },
    create: {
      method: 'POST',
      path: '/users/create',
      input: createUserSchema,
      output: userSchema
    },
    update: {
      method: 'PUT',
      path: '/users/:id/update',
      input: createUserSchema.partial(),
      output: userSchema
    },
    delete: {
      method: 'DELETE',
      path: '/users/:id/delete',
      input: z.object({ id: z.number() }),
      output: z.object({ success: z.boolean(), user: userSchema })
    }
  }
})

export const api = createVisionClient<typeof routes>({
  baseUrl: 'http://localhost:3000',
  dashboardUrl: 'http://localhost:9500',

  // Optional: Add auth headers
  // headers: async () => ({
  //   authorization: `Bearer ${await getToken()}`
  // })
})

// Type exports for use in components
export type User = z.infer<typeof userSchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
