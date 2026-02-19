/**
 * Shared route schemas - Single Source of Truth
 * Used by both server (validation) and client (types + runtime)
 */

import { z } from 'zod'

// Schemas
const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.string().datetime()
})

const createUserSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1),
  email: z.string().email()
})

const paginationSchema = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(10)
})

// Route contracts - используются и на сервере и на клиенте!
export const routes = {
  users: {
    list: {
      method: 'GET' as const,
      path: '/users/list',
      input: paginationSchema,
      output: z.object({
        users: z.array(userSchema),
        page: z.number(),
        limit: z.number(),
        total: z.number()
      })
    },
    create: {
      method: 'POST' as const,
      path: '/users/create',
      input: createUserSchema,
      output: userSchema
    },
    get: {
      method: 'GET' as const,
      path: '/users/:id',
      input: z.object({ id: z.coerce.number() }),
      output: userSchema
    },
    update: {
      method: 'PUT' as const,
      path: '/users/:id/update',
      input: createUserSchema.partial(),
      output: userSchema
    },
    delete: {
      method: 'DELETE' as const,
      path: '/users/:id/delete',
      input: z.object({ id: z.coerce.number() }),
      output: z.object({ success: z.boolean(), user: userSchema })
    }
  }
} as const

// Type exports
export type User = z.infer<typeof userSchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
