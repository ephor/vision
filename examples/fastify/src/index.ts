import Fastify from 'fastify'
import analyticsPlugin from './plugins/analytics'
import { visionPlugin, enableAutoDiscovery, useVisionSpan } from '@getvision/adapter-fastify'
import { z } from 'zod'
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod'

async function start() {
  console.log('Starting Fastify app...')
  
  const app = Fastify({
    logger: true
  })

  // Add Zod validator and serializer
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  // Register Vision plugin
  if (process.env.NODE_ENV !== 'production') {
    await app.register(visionPlugin, {
      port: 9500,
      logging: true,
      service: {
        name: 'Fastify Basic Example',
        version: '1.0.0',
        description: 'Example Fastify app with Vision',
        integrations: {
          database: 'PostgreSQL',
        },
      },
    })
  }

  // Root route
  app.get('/', async (request, reply) => {
    return {
      name: 'Fastify Basic Example',
      version: '1.0.0',
      endpoints: [
        'GET /',
        'GET /users',
        'GET /users/:id',
        'POST /users',
        'PUT /users/:id',
        'DELETE /users/:id',
      ],
    }
  })

  // Get all users
  app.get('/users', async (request, reply) => {
    const withSpan = useVisionSpan()

    const users = withSpan('db.select', {
      'db.system': 'postgresql',
      'db.table': 'users',
    }, () => {
      // Simulate DB delay
      const sleep = (ms: number) => {
        const start = Date.now()
        while (Date.now() - start < ms) {}
      }
      sleep(30)
      
      return [
        { id: 1, name: 'Alice', email: 'alice@example.com' },
        { id: 2, name: 'Bob', email: 'bob@example.com' },
      ]
    })

    return { users }
  })

  // Get user by ID
  app.withTypeProvider<ZodTypeProvider>().get('/users/:id', {
    schema: {
      params: z.object({
        id: z.string().describe('User ID'),
      })
    }
  }, async (request, reply) => {
    const id = parseInt(request.params.id)
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
      sleep(50)
      const users = [
        { id: 1, name: 'Alice', email: 'alice@example.com', articles: [] },
        { id: 2, name: 'Bob', email: 'bob@example.com', articles: [] },
      ]
      return users.find(u => u.id === id)
    })

    if (!user) {
      reply.code(404)
      return { error: 'User not found' }
    }

    const userArticles = withSpan('db.select', {
      'db.system': 'postgresql',
      'db.table': 'articles',
      'article.user_id': id,
    }, () => {
      sleep(80)
      const articles = [
        { id: 1, title: 'Article 1', content: 'Content 1', user_id: 1 },
        { id: 2, title: 'Article 2', content: 'Content 2', user_id: 2 },
      ]
      return articles.filter(a => a.user_id === id)
    })

    user.articles = userArticles as any

    return user
  })

  // Create user with Zod validation
  const CreateUserSchema = z.object({
    name: z.string().min(1).describe('Full name'),
    email: z.string().email().describe('Email address'),
    age: z.number().int().positive().optional().describe('Age (optional)'),
  })

  app.withTypeProvider<ZodTypeProvider>().post('/users', {
    schema: {
      body: CreateUserSchema
    }
  }, async (request, reply) => {
    const withSpan = useVisionSpan()

    const newUser = withSpan('db.insert', {
      'db.system': 'postgresql',
      'db.table': 'users',
    }, () => {
      return {
        id: 3,
        ...request.body,
      }
    })

    reply.code(201)
    return newUser
  })

  // Update user
  const UpdateUserSchema = z.object({
    name: z.string().min(1).optional().describe('Full name (optional)'),
    email: z.string().email().optional().describe('Email address (optional)'),
    age: z.number().int().positive().optional().describe('Age (optional)'),
  })

  app.withTypeProvider<ZodTypeProvider>().put('/users/:id', {
    schema: {
      params: z.object({
        id: z.string().describe('User ID'),
      }),
      body: UpdateUserSchema
    }
  }, async (request, reply) => {
    const id = parseInt(request.params.id)
    const withSpan = useVisionSpan()

    const updated = withSpan('db.update', {
      'db.system': 'postgresql',
      'db.table': 'users',
      'user.id': id,
    }, () => {
      return {
        id,
        name: 'Alice Updated',
        email: 'alice.updated@example.com',
        ...request.body,
      }
    })

    return updated
  })

  // Delete user
  app.delete<{ Params: { id: string } }>('/users/:id', async (request, reply) => {
    const id = parseInt(request.params.id)
    const withSpan = useVisionSpan()

    withSpan('db.delete', {
      'db.system': 'postgresql',
      'db.table': 'users',
      'user.id': id,
    }, () => {
      // Simulate delete
      return true
    })

    reply.code(204)
    return
  })

  await app.register(analyticsPlugin, { prefix: '/analytics' })
  // Enable auto-discovery after all routes
  if (process.env.NODE_ENV !== 'production') {
    // Mount nested analytics plugin with prefix
    enableAutoDiscovery(app, {
      services: [
        {
          name: 'Users',
          description: 'User management endpoints',
          routes: ['/users', '/users/*'],
        },
        {
          name: 'Analytics',
          description: 'Analytics endpoints',
          routes: ['/analytics', '/analytics/*']
        },
      ],
    })
  }

  // Start server
  try {
    await app.listen({ port: 3000, host: '0.0.0.0' })
  } catch (err) {
    console.error('Failed to start server:', err)
    app.log.error(err)
    process.exit(1)
  }
}

start().catch((err) => {
  console.error('Unhandled error in start():', err)
  process.exit(1)
})
