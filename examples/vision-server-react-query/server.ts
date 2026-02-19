/**
 * Vision Server Example
 * Demonstrates type-safe endpoints with Zod validation
 */

import { Vision } from '@getvision/server'
import { z } from 'zod'
import { cors } from 'hono/cors'

const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.string(),
})

type User = z.infer<typeof userSchema>

const users: User[] = [
  { id: '1', name: 'Alice', email: 'alice@example.com', createdAt: '2024-01-01' },
  { id: '2', name: 'Bob', email: 'bob@example.com', createdAt: '2024-01-02' },
]

const app = new Vision({
  service: {
    name: 'Demo API',
    version: '1.0.0',
    description: 'Vision Server + React Query Demo',
  },
  vision: {
    enabled: true,
    port: 9500,
    apiUrl: 'http://localhost:4000',
  },
  pubsub: {
    devMode: true,
  },
})

app.use("*", cors())

const userService = app
  .service('users')
  .endpoint(
    'GET',
    '/users',
    {
      input: z.object({
        page: z.coerce.number().default(1),
        limit: z.coerce.number().default(10),
      }),
      output: z.object({
        users: z.array(userSchema),
        total: z.number(),
        page: z.number(),
        limit: z.number(),
      }),
    },
    async (input) => {
      const { page, limit } = input
      const start = (page - 1) * limit
      const paginatedUsers = users.slice(start, start + limit)
      return {
        users: paginatedUsers,
        total: users.length,
        page,
        limit,
      }
    }
  )
  .endpoint(
    'GET',
    '/users/:id',
    {
      input: z.object({
        id: z.string(),
      }),
      output: userSchema,
    },
    async (input) => {
      const user = users.find((u) => u.id === input.id)
      if (!user) {
        throw new Error('User not found')
      }
      return user
    }
  )
  .endpoint(
    'POST',
    '/users',
    {
      input: z.object({
        name: z.string().min(1, 'Name is required'),
        email: z.string().email('Invalid email'),
      }),
      output: userSchema,
    },
    async (input) => {
      const newUser: User = {
        id: String(users.length + 1),
        name: input.name,
        email: input.email,
        createdAt: new Date().toISOString(),
      }
      users.push(newUser)
      return newUser
    }
  )
  .endpoint(
    'PUT',
    '/users/:id',
    {
      input: z.object({
        id: z.string(),
        name: z.string().optional(),
        email: z.string().email().optional(),
      }),
      output: userSchema,
    },
    async (input) => {
      const userIndex = users.findIndex((u) => u.id === input.id)
      if (userIndex === -1) {
        throw new Error('User not found')
      }
      const updated = {
        ...users[userIndex],
        ...(input.name && { name: input.name }),
        ...(input.email && { email: input.email }),
      }
      users[userIndex] = updated
      return updated
    }
  )
  .endpoint(
    'DELETE',
    '/users/:id',
    {
      input: z.object({
        id: z.string(),
      }),
      output: z.object({
        success: z.boolean(),
        deletedUser: userSchema,
      }),
    },
    async (input) => {
      const userIndex = users.findIndex((u) => u.id === input.id)
      if (userIndex === -1) {
        throw new Error('User not found')
      }
      const [deletedUser] = users.splice(userIndex, 1)
      return { success: true, deletedUser }
    }
  )

export type UserService = typeof userService

app.start(4000)
