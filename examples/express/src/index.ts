import express from 'express'
import analyticsRouter from './routers/analytics'
import { visionMiddleware, enableAutoDiscovery, useVisionSpan, validator } from '@getvision/adapter-express'
import * as v from 'valibot'

const app = express()

// Parse JSON bodies
app.use(express.json())

// Zod schemas for validation
const createUserSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1), v.description('User full name')),
  email: v.pipe(v.string(), v.email(), v.description('User email address')),
  age: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.description('User age (optional)'))),
})

const updateUserSchema = v.object({
  name: v.optional(v.pipe(v.string(), v.minLength(1), v.description('User full name (optional)'))),
  email: v.optional(v.pipe(v.string(), v.email(), v.description('User email address (optional)'))),
  age: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.description('User age (optional)'))),
})

const getUserSchema = v.object({
  id: v.pipe(v.number(), v.integer(), v.minValue(1)),
})

// Add Vision Dashboard (development only)
if (process.env.NODE_ENV !== 'production') {
  app.use(visionMiddleware({
    port: 9500,
    enabled: true,
    apiUrl: 'http://localhost:3000',
    service: {
      name: 'Express API',
      version: '1.0.0',
      description: 'Example Express API with Vision',
    },
  }))
}

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Hello from Express with Vision!',
    timestamp: new Date().toISOString(),
  })
})

app.get('/users', validator('query', getUserSchema), async (req, res) => {
  const withSpan = useVisionSpan()
  
  // Simulate database query with span
  const users = withSpan('db.select', { 
    'db.system': 'postgresql', 
    'db.table': 'users' 
  }, () => {
    // Simulate async work
    return [
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' },
      { id: 3, name: 'Charlie', email: 'charlie@example.com' },
    ]
  })
  
  res.json({ users })
})

app.get('/users/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  const withSpan = useVisionSpan()
  
  // Helper for sync sleep (for demo purposes)
  const sleep = (ms: number) => {
    const start = Date.now()
    while (Date.now() - start < ms) {}
  }
  
  const user = withSpan('db.select', {
    'db.system': 'postgresql',
    'db.table': 'users',
    'user.id': id,
  }, () => {
    sleep(50) // Simulate DB query delay
    const users = [
      { id: 1, name: 'Alice', email: 'alice@example.com', articles: [] },
      { id: 2, name: 'Bob', email: 'bob@example.com', articles: [] },
    ]
    return users.find(u => u.id === id)
  })
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }

  const userArticles = withSpan('db.select', {
    'db.system': 'postgresql',
    'db.table': 'articles',
    'article.user_id': id,
  }, () => {
    sleep(80) // Simulate DB query delay
    const articles = [
      { id: 1, title: 'Article 1', content: 'Content 1', user_id: 1 },
      { id: 2, title: 'Article 2', content: 'Content 2', user_id: 2 },
    ]
    return articles.filter(a => a.user_id === id)
  })

  user.articles = userArticles as any
  
  res.json(user)
})

app.post('/users', validator('body', createUserSchema), async (req, res) => {
  const { name, email, age } = req.body
  const withSpan = useVisionSpan()
  
  const newUser = withSpan('db.insert', {
    'db.system': 'postgresql',
    'db.table': 'users',
  }, () => {
    return {
      id: Math.floor(Math.random() * 1000),
      name,
      email,
      age,
      createdAt: new Date().toISOString(),
    }
  })
  
  res.status(201).json(newUser)
})

app.put('/users/:id', validator('body', updateUserSchema), async (req, res) => {
  const id = parseInt(req.params.id)
  const { name, email, age } = req.body
  const withSpan = useVisionSpan()
  
  const updatedUser = withSpan('db.update', {
    'db.system': 'postgresql',
    'db.table': 'users',
    'user.id': id,
  }, () => {
    return {
      id,
      name: name || 'Updated User',
      email: email || 'updated@example.com',
      age,
      updatedAt: new Date().toISOString(),
    }
  })
  
  res.json(updatedUser)
})

app.delete('/users/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  const withSpan = useVisionSpan()
  
  withSpan('db.delete', {
    'db.system': 'postgresql',
    'db.table': 'users',
    'user.id': id,
  }, () => {
    // Simulate deletion
    return true
  })
  
  res.status(204).send()
})

// Mount nested routers
app.use('/analytics', analyticsRouter)

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Internal Server Error' })
})

// Enable auto-discovery after all routes are defined
if (process.env.NODE_ENV !== 'production') {
  enableAutoDiscovery(app)
}

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`🚀 Express server running on http://localhost:${PORT}`)
})
