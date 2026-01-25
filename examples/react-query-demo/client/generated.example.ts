/**
 * Auto-generated Vision React Query Client
 * @generated
 * DO NOT EDIT MANUALLY
 *
 * Generated at: 2026-01-24T15:00:00.000Z
 * Edit your server routes and restart to regenerate
 */

import { createVisionClient } from '@getvision/react-query'
import { z } from 'zod'

// Auto-generated schemas from server routes
const users_list_input = z.object({
  page: z.number(),
  limit: z.number()
})

const users_list_output = z.object({
  users: z.array(z.object({
    id: z.number(),
    name: z.string(),
    email: z.string().email(),
    createdAt: z.string().datetime()
  })),
  page: z.number(),
  limit: z.number(),
  total: z.number()
})

const users_create_input = z.object({
  name: z.string(),
  email: z.string().email()
})

const users_create_output = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.string().datetime()
})

const users_update_input = z.object({
  name: z.string().optional(),
  email: z.string().email().optional()
})

const users_update_output = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.string().datetime()
})

const users_delete_input = z.void()

const users_delete_output = z.object({
  success: z.boolean(),
  user: z.object({
    id: z.number(),
    name: z.string(),
    email: z.string().email(),
    createdAt: z.string().datetime()
  })
})

// Auto-generated routes
const routes = {
  users: {
    list: {
      method: 'GET' as const,
      path: '/users/list',
      input: users_list_input,
      output: users_list_output,
    },
    create: {
      method: 'POST' as const,
      path: '/users/create',
      input: users_create_input,
      output: users_create_output,
    },
    update: {
      method: 'PUT' as const,
      path: '/users/:id/update',
      input: users_update_input,
      output: users_update_output,
    },
    delete: {
      method: 'DELETE' as const,
      path: '/users/:id/delete',
      input: users_delete_input,
      output: users_delete_output,
    }
  }
} as const

/**
 * Type-safe API client
 * Auto-generated from server routes
 */
export const api = createVisionClient(routes, {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
})

// Type exports
export type UsersListInput = z.infer<typeof users_list_input>
export type UsersListOutput = z.infer<typeof users_list_output>
export type UsersCreateInput = z.infer<typeof users_create_input>
export type UsersCreateOutput = z.infer<typeof users_create_output>
export type UsersUpdateInput = z.infer<typeof users_update_input>
export type UsersUpdateOutput = z.infer<typeof users_update_output>
export type UsersDeleteInput = z.infer<typeof users_delete_input>
export type UsersDeleteOutput = z.infer<typeof users_delete_output>

// Convenience type exports
export type User = z.infer<typeof users_create_output>
