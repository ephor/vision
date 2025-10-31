import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { z } from 'zod'
import { visionAdapter, enableAutoDiscovery, useVisionSpan, zValidator } from '@getvision/adapter-hono'
import { db } from './db'
import { users } from './db/schema'
import { eq } from 'drizzle-orm'
import analytics from './analitycs'

// Zod schemas for validation
const createUserSchema = z.object({
  name: z.string().min(1).describe('User full name'),
  email: z.string().email().describe('User email address'),
  age: z.number().int().positive().optional().describe('User age (optional)'),
})

const updateUserSchema = z.object({
  name: z.string().min(1).optional().describe('User full name (optional)'),
  email: z.string().email().optional().describe('User email address (optional)'),
  age: z.number().int().positive().optional().describe('User age (optional)'),
})

const app = new Hono()

// Add Vision Dashboard in development (BEFORE other middleware!)
if (process.env.NODE_ENV !== 'production') {
  app.use('*', visionAdapter({
    name: "Payment API",
    port: 9500,
    enabled: true,
    service: {
      integrations: {
        database: 'sqlite://./dev.db'
      }
    },
    drizzle: {
      autoStart: true,  // Auto-start Drizzle Studio
      port: 4983,
    },
  }))
  // Enable auto-discovery after all routes and mounts
  if (process.env.NODE_ENV !== 'production') {
    enableAutoDiscovery(app, {
      services: [
        {
          name: 'Users',
          routes: ['/users', '/users/*']
        },
        {
          name: 'Analytics',
          routes: ['/analytics', '/analytics/*']
        }
      ]
    })
  }
}

// Enable CORS for all routes and expose Vision headers
app.use('*', cors({
  origin: '*',
  exposeHeaders: ['X-Vision-Trace-Id'],
}))

// No need for custom helper! Using vision.createSpanHelper() from core

// Routes
app.get('/', (c) => {
  return c.json({ 
    message: 'Hello from Hono with Drizzle!',
    timestamp: new Date().toISOString(),
  })
})

// Get all users (with DB span)
app.get('/users', async (c) => {
  const withSpan = useVisionSpan()
  
  const allUsers = withSpan('db.select', { 'db.system': 'sqlite', 'db.table': 'users' }, () => {
    return db.select().from(users).all()
  })
  
  return c.json({ users: allUsers })
})

// Get user by ID (with DB span)
app.get('/users/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const withSpan = useVisionSpan()
  
  const user = withSpan('db.select', { 'db.system': 'sqlite', 'db.table': 'users', 'user.id': id }, () => {
    return db.select().from(users).where(eq(users.id, id)).get()
  })
  
  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }
  
  return c.json(user)
})

// Create user (with Zod validation and DB span)
app.post('/users', zValidator('json', createUserSchema), async (c) => {
  const body = c.req.valid('json')
  const withSpan = useVisionSpan()
  
  const newUser = withSpan('db.insert', { 'db.system': 'sqlite', 'db.table': 'users' }, () => {
    return db.insert(users).values({
      name: body.name,
      email: body.email,
      age: body.age,
    }).returning().get()
  })
  
  return c.json(newUser, 201)
})

// Update user (with Zod validation and DB span)
app.put('/users/:id', zValidator('json', updateUserSchema), async (c) => {
  const id = parseInt(c.req.param('id'))
  const body = c.req.valid('json')
  const withSpan = useVisionSpan()
  
  const updated = withSpan('db.update', { 'db.system': 'sqlite', 'db.table': 'users', 'user.id': id }, () => {
    return db.update(users)
      .set({ 
        ...(body.name && { name: body.name }),
        ...(body.email && { email: body.email }),
        ...(body.age && { age: body.age }),
      })
      .where(eq(users.id, id))
      .returning()
      .get()
  })
  
  if (!updated) {
    return c.json({ error: 'User not found' }, 404)
  }
  
  return c.json(updated)
})

// Delete user (with DB span)
app.delete('/users/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const withSpan = useVisionSpan()
  
  withSpan('db.delete', { 'db.system': 'sqlite', 'db.table': 'users', 'user.id': id }, () => {
    db.delete(users).where(eq(users.id, id)).run()
  })
  
  return c.json({ success: true })
})

app.get('/slow', async (c) => {
  // Simulate slow endpoint
  await new Promise(resolve => setTimeout(resolve, 2000))
  return c.json({ message: 'This was slow!' })
})

app.route('/analytics', analytics)

app.get('/error', (c) => {
  throw new Error('Something went wrong!')
})

serve(app, () => {
  console.log(`Listening on http://localhost:3000`) // Listening on http://localhost:3000
})
