/**
 * Vision React Query Demo Server
 * Shows how to use Vision with tRPC-like client
 */

import { Hono } from 'hono'
import { visionAdapter, enableAutoDiscovery, validator } from '@getvision/adapter-hono'
import { z } from 'zod'

const app = new Hono()

// Add Vision adapter
app.use('*', visionAdapter({
  port: 9500,
  service: { name: 'React Query Demo API' }
}))

// Types
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

const paginationSchema = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(10)
})

// In-memory database
const users: Array<z.infer<typeof userSchema>> = [
  {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    createdAt: new Date().toISOString()
  },
  {
    id: 2,
    name: 'Jane Smith',
    email: 'jane@example.com',
    createdAt: new Date().toISOString()
  }
]

// Routes - standard REST endpoints
app.get('/users/list', validator('query', paginationSchema), (c) => {
  const { page, limit } = c.req.valid('query')
  const start = (page - 1) * limit
  const end = start + limit

  return c.json({
    users: users.slice(start, end),
    page,
    limit,
    total: users.length
  })
})

app.get('/users/:id', (c) => {
  const id = parseInt(c.req.param('id'))
  const user = users.find(u => u.id === id)

  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  return c.json(user)
})

app.post('/users/create', validator('json', createUserSchema), (c) => {
  const input = c.req.valid('json')

  const newUser = {
    id: users.length + 1,
    ...input,
    createdAt: new Date().toISOString()
  }

  users.push(newUser)

  console.log('Created new user:', newUser.name)

  return c.json(newUser, 201)
})

app.put('/users/:id/update', validator('json', createUserSchema.partial()), (c) => {
  const id = parseInt(c.req.param('id'))
  const input = c.req.valid('json')

  const userIndex = users.findIndex(u => u.id === id)
  if (userIndex === -1) {
    return c.json({ error: 'User not found' }, 404)
  }

  users[userIndex] = { ...users[userIndex], ...input }

  console.log('Updated user:', users[userIndex].name)

  return c.json(users[userIndex])
})

app.delete('/users/:id/delete', (c) => {
  const id = parseInt(c.req.param('id'))
  const userIndex = users.findIndex(u => u.id === id)

  if (userIndex === -1) {
    return c.json({ error: 'User not found' }, 404)
  }

  const deletedUser = users.splice(userIndex, 1)[0]

  console.log('Deleted user:', deletedUser.name)

  return c.json({ success: true, user: deletedUser })
})

// Enable auto-discovery
enableAutoDiscovery(app)

const port = 3000
console.log(`🚀 Server running at http://localhost:${port}`)
console.log(`📊 Vision Dashboard at http://localhost:9500`)

export default {
  port,
  fetch: app.fetch,
}

// Export type for client
export type AppRouter = typeof app
