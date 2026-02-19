/**
 * Server-side schemas for validation
 * Using responseSchema() to declare outputs for auto-codegen
 */

import { z } from 'zod'

// Input schemas
export const paginationSchema = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(10)
})

export const createUserSchema = z.object({
  id: z.number(),
  name: z.string().min(1),
  email: z.string().email()
})

export const updateUserSchema = createUserSchema.partial()

// Output schemas
export const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.string().datetime()
})

export const userListSchema = z.object({
  users: z.array(userSchema),
  page: z.number(),
  limit: z.number(),
  total: z.number()
})

export const deleteUserSchema = z.object({
  success: z.boolean(),
  user: userSchema
})

// Type exports
export type User = z.infer<typeof userSchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
