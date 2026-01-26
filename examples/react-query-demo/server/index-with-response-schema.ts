/**
 * Vision React Query Demo Server with responseSchema
 * Shows how to use responseSchema() for output type inference
 */

import { Hono } from 'hono'
import { visionAdapter, enableAutoDiscovery, validator, responseSchema } from '@getvision/adapter-hono'
import {
  paginationSchema,
  createUserSchema,
  updateUserSchema,
  userSchema,
  userListSchema,
  deleteUserSchema,
  type User
} from './schemas'

const app = new Hono()

// Add Vision adapter with auto-codegen
app.use('*', visionAdapter({
  port: 9500,
  service: { name: 'React Query Demo API' },
  // 🔥 Auto-generate type-safe client with output types!
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

// Routes with responseSchema for output types
app.get('/users/list',
  validator('query', paginationSchema),
  responseSchema(userListSchema), // ← Declares output schema
  (c) => {
    const { page, limit } = c.req.valid('query')
    const start = (page - 1) * limit
    const end = start + limit

    return c.json({
      users: users.slice(start, end),
      page,
      limit,
      total: users.length
    })
  }
)

app.get('/users/:id',
  responseSchema(userSchema), // ← Declares output schema
  (c) => {
    const id = parseInt(c.req.param('id'))
    const user = users.find(u => u.id === id)

    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    return c.json(user)
  }
)

app.post('/users/create',
  validator('json', createUserSchema),
  responseSchema(userSchema), // ← Declares output schema
  (c) => {
    const data = c.req.valid('json')
    const newUser: User = {
      id: users.length + 1,
      ...data,
      createdAt: new Date().toISOString()
    }
    users.push(newUser)
    return c.json(newUser)
  }
)

app.put('/users/:id/update',
  validator('json', updateUserSchema),
  responseSchema(userSchema), // ← Declares output schema
  (c) => {
    const id = parseInt(c.req.param('id'))
    const updates = c.req.valid('json')
    const userIndex = users.findIndex(u => u.id === id)

    if (userIndex === -1) {
      return c.json({ error: 'User not found' }, 404)
    }

    users[userIndex] = { ...users[userIndex], ...updates }
    return c.json(users[userIndex])
  }
)

app.delete('/users/:id/delete',
  responseSchema(deleteUserSchema), // ← Declares output schema
  (c) => {
    const id = parseInt(c.req.param('id'))
    const userIndex = users.findIndex(u => u.id === id)

    if (userIndex === -1) {
      return c.json({ error: 'User not found' }, 404)
    }

    const deletedUser = users.splice(userIndex, 1)[0]
    return c.json({ success: true, user: deletedUser })
  }
)

const port = 3000
console.log(`🚀 Server running at http://localhost:${port}`)
console.log(`📊 Vision Dashboard at http://localhost:9500`)

export default {
  port,
  fetch: app.fetch,
}
