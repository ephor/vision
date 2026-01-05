import { config } from "dotenv"
import { Vision } from '@getvision/server'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { z } from 'zod'
import type { DrizzleD1Database } from 'drizzle-orm/d1' // example

config({ path: '.env.development' })

// ============================================================================
// Create Vision App - Everything automatic! 🚀
// ============================================================================

type Variables = {
  db: DrizzleD1Database;
};

const app = new Vision({
  service: {
    name: 'Vision hybrid routes',
    version: '1.0.0',
    description: 'Example app using Vision Server meta-framework',
    integrations: {
      database: 'sqlite://./dev.db'
    },
    drizzle: {
      autoStart: true,  // Auto-start Drizzle Studio
      port: 4983,
    }
  },
  vision: {
    enabled: true,
    port: 9500,
    apiUrl: 'http://localhost:4000'  // Tell dashboard where API server is running
  },
  pubsub: {
    devMode: true,  // Use in-memory event bus (no Redis required)
  }
})

app.use('*', logger())
app.use('*', cors())

// ============================================================================
// Define Services - using app.service()!
// ============================================================================

// User Service
app.service<{ Variables: Variables; }>('users')
  // some middleware that ingects something in context (db as well)))
  .use((c, next) => {
    c.set("db", "db" as unknown as DrizzleD1Database);
    return next();
  })
  .endpoint(
    'GET',
    '/users',
    {
      input: z.object({}),
      output: z.object({
        users: z.array(z.object({
          id: z.string(),
          name: z.string(),
          email: z.string()
        }))
      })
    },
    async (_, c) => {
      // c.span() and c.get("db") are built into context! 🔥
      const users = c.span('db.select', {
        'db.system': 'postgresql',
        'db.table': 'users'
      }, () => {
        // Sync sleep for demo
        const sleep = (ms: number) => {
          const start = Date.now()
          while (Date.now() - start < ms) {}
        }
        sleep(30)
        
        return [
          { id: '1', name: 'Alice', email: 'alice@example.com' },
          { id: '2', name: 'Bob', email: 'bob@example.com' }
        ]
      })
      
      return { users }
    },
    {
      ratelimit: {
        requests: 10,
        window: '15m'
      }
    }
  )
  .endpoint(
    'GET',
    '/users/:id',
    {
      input: z.object({
        id: z.string()
      }),
      output: z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
        articles: z.array(z.object({
          id: z.string(),
          title: z.string()
        }))
      })
    },
    async ({ id }, c) => {
      // Example: Add context using built-in c.addContext()
      c.addContext({
        'user.id': id,
        'request.type': 'user_details'
      })

      const sleep = (ms: number) => {
        const start = Date.now()
        while (Date.now() - start < ms) {}
      }

      console.log('User ID:', id)
      
      // First span - fetch user (c.span is built-in!)
      const user = c.span('db.select', {
        'db.system': 'postgresql',
        'db.table': 'users',
        'user.id': id
      }, () => {
        sleep(50)
        return { id, name: 'Alice', email: 'alice@example.com' }
      })

      console.log("------------user---------------");
      console.log(user);
      console.log("------------user---------------");
      
      // Second span - fetch articles
      const articles = c.span('db.select', {
        'db.system': 'postgresql',
        'db.table': 'articles',
        'article.user_id': id
      }, () => {
        sleep(80)
        return [
          { id: '1', title: 'First Article' },
          { id: '2', title: 'Second Article' }
        ]
      })
      
      return { ...user, articles }
    }
  )
  .on('user/created', {
    schema: z.object({
      userId: z.string(),
      email: z.string().email(),
      name: z.string()
    }),
    description: 'User account created',
    icon: '👤',
    tags: ['user', 'auth'],
    handler: async (event, c) => {
      // Demonstrate event handler context: read db injected by service middleware
      const db = c.get('db');
      // Simulate a write using the db
      console.log('🗄️ Saving user to DB via event handler with db =', db)
      console.log('📧 Sending welcome email to:', event.email)
    }
  })
  .cron('0 0 * * *', {
    description: 'Daily user cleanup',
    icon: '🧹',
    tags: ['maintenance'],
    handler: async (c) => {
      console.log('🧹 Running daily user cleanup')
    }
  })
  .endpoint(
    'POST',
    '/users',
    {
      input: z.object({
        name: z.string().min(1).describe('Full name'),
        email: z.string().email().describe('Email address')
      }),
      output: z.object({
        id: z.string(),
        name: z.string(),
        email: z.string()
      })
    },
    async (data, c) => {
      const userId = Math.random().toString(36).substring(7)
      
      // Insert to DB with c.span()
      const user = c.span('db.insert', {
        'db.system': 'postgresql',
        'db.table': 'users'
      }, () => {
        return { id: userId, ...data }
      })
      
      // Emit event (automatically validated with Zod!)
      await c.emit('user/created', {
        userId,
        email: data.email,
        name: data.name
      });
      
      return user
    }
  )

// Order Service
app.service('orders')
  .on('order/placed', {
    schema: z.object({
      orderId: z.string(),
      userId: z.string(),
      total: z.number()
    }),
    description: 'Order placed',
    icon: '📦',
    tags: ['order', 'payment'],
    handler: async (event) => {
      // event is fully typed from the schema!
      // If you try to access event.dd (which doesn't exist in schema),
      // TypeScript will warn you, and runtime validation will catch it
      console.log('📦 Processing order:', event.orderId)
    }
  })
  .endpoint(
    'POST',
    '/orders',
    {
      input: z.object({
        userId: z.string(),
        items: z.array(z.object({
          productId: z.string(),
          quantity: z.number().int().positive()
        })),
        total: z.number().positive()
      }),
      output: z.object({
        orderId: z.string(),
        status: z.string(),
        total: z.number()
      })
    },
    async (data, c) => {
      const orderId = Math.random().toString(36).substring(7)
      
      // Insert order with c.span()
      c.span('db.insert', {
        'db.system': 'postgresql',
        'db.table': 'orders'
      }, () => {
        const sleep = (ms: number) => {
          const start = Date.now()
          while (Date.now() - start < ms) {}
        }
        sleep(40)
      })
      
      // Emit event (type-safe - TypeScript checks the event schema!)
      await c.emit('order/placed', {
        orderId,
        userId: data.userId,
        total: data.total,
      })
      
      return {
        orderId,
        status: 'pending',
        total: data.total
      }
    }
  )

// ============================================================================
// Root Route - Hono-style still works!
// ============================================================================

app.get('/', (c) => {
  return c.json({
    name: 'Vision Server - Basic Example',
    version: '1.0.0',
    description: 'Demonstrating inline services + file-based routes (Next.js-style)',
    inline_services: [
      'Users',
      'Orders'
    ],
    file_based_routes: [
      'GET /products',
      'GET /products/:id',
      'POST /products/create',
      'GET /analytics/dashboard',
      'POST /analytics/track',
      'POST /notifications'
    ],
    all_endpoints: [
      'GET /',
      'GET /users',
      'GET /users/:id',
      'POST /users',
      'POST /orders',
      'GET /products',
      'GET /products/:id',
      'POST /products/create',
      'GET /analytics/dashboard',
      'POST /analytics/track',
      'POST /notifications'
    ],
    dashboard: 'http://localhost:9500'
  })
})

// ============================================================================
// Start Server - Vision handles everything!
// ============================================================================

app.start(4000)

// Export AppType for Hono RPC client
export type AppType = typeof app
