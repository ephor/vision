/**
 * Auto-generated Vision React Query Client
 * @generated
 * DO NOT EDIT MANUALLY
 */

import { createVisionClient } from '@getvision/react-query'
import { z } from 'zod'

const users_list_input = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(10)
})
const users_list_output = z.object({
  users: z.array(z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  createdAt: z.string()
})),
  page: z.number(),
  limit: z.number(),
  total: z.number()
})
const users__id_input = z.void()
const users__id_output = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  createdAt: z.string()
})
const users_create_input = z.object({
  name: z.string(),
  email: z.string()
})
const users_create_output = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  createdAt: z.string()
})
const users_update_input = z.object({
  name: z.unknown().optional(),
  email: z.unknown().optional()
})
const users_update_output = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  createdAt: z.string()
})
const users_delete_input = z.void()
const users_delete_output = z.object({
  success: z.boolean(),
  user: z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  createdAt: z.string()
})
})


const routes = {
  users: {
    list: {
      method: 'GET' as const,
      path: '/users/list',
      input: users_list_input,
      output: users_list_output,
    },
    _id: {
      method: 'GET' as const,
      path: '/users/:id',
      input: users__id_input,
      output: users__id_output,
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
 * Auto-generated Vision React Query client
 * Generated at: 2026-01-26T09:12:53.483Z
 *
 * DO NOT EDIT MANUALLY - This file is auto-generated
 * Edit your server routes and restart to regenerate
 */

export const api = createVisionClient(routes, {
  baseUrl: 'http://localhost:3000'
})

// Type exports
export type UsersListInput = z.infer<typeof users_list_input>
export type UsersListOutput = z.infer<typeof users_list_output>
export type Users_idInput = z.infer<typeof users__id_input>
export type Users_idOutput = z.infer<typeof users__id_output>
export type UsersCreateInput = z.infer<typeof users_create_input>
export type UsersCreateOutput = z.infer<typeof users_create_output>
export type UsersUpdateInput = z.infer<typeof users_update_input>
export type UsersUpdateOutput = z.infer<typeof users_update_output>
export type UsersDeleteInput = z.infer<typeof users_delete_input>
export type UsersDeleteOutput = z.infer<typeof users_delete_output>
