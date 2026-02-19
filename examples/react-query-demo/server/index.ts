/**
 * Vision React Query Demo Server
 * Shows how to use Vision with tRPC-like client
 */

import { Hono } from 'hono'
import { visionAdapter, enableAutoDiscovery, validator } from '@getvision/adapter-hono'
import { routes, type User } from '../shared/routes'

const app = new Hono()

// Add Vision adapter with auto-codegen
app.use('*', visionAdapter({
  port: 9500,
  service: { name: 'React Query Demo API' },
  // 🔥 Auto-generate type-safe client!
  client: {
    output: './client/generated.ts',
    baseUrl: 'http://localhost:3000',
    watch: true,
    includeValidation: true
  }
}))

// IMPORTANT: Enable auto-discovery BEFORE defining routes
enableAutoDiscovery(app)

// In-memory database
const users: User[] = [
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

// Routes - use shared schemas from routes contract
app.get('/users/list', validator('query', routes.users.list.input), (c) => {
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

app.post('/users/create', validator('json', routes.users.create.input), (c) => {
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

app.put('/users/:id/update', validator('json', routes.users.update.input), (c) => {
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

const port = 3000

export default {
  port,
  fetch: app.fetch,
}

// Export type for client
export type AppRouter = typeof app
