# @getvision/server

**Meta-framework with built-in observability — everything you need, nothing you don't.**

Built on Hono. Automatic tracing. Type-safe APIs. Pub/Sub & Cron. Zero config. Supports both Service Builder and File-based routing.

## Why Vision Server?

**vs NestJS:** Faster, simpler, better DX  
**vs Encore.ts:** Open source, no vendor lock-in  
**vs Plain Hono:** Built-in observability, type-safety, pub/sub & cron

## Quick Start

```bash
npm install @getvision/server
```

```typescript
import { Vision } from '@getvision/server'
import { z } from 'zod'

const app = new Vision({
  service: {
    name: 'My API',
    version: '1.0.0'
  }
})

// Define services
app.service('users')
  .endpoint('GET', '/users/:id', {
    input: z.object({ id: z.string() }),
    output: z.object({ id: z.string(), name: z.string() })
  }, async ({ id }, c) => {
    // c.span() is built-in! 🔥
    const user = c.span('db.select', { 'db.table': 'users' }, () => {
      return { id, name: 'John' }
    })
    return user
  })
  .on('user/created', async (event) => {
    console.log('User created:', event.data)
  })

// Start server
app.start(3000)
```

**That's it!** You get:
- ✅ Vision Dashboard on port 9500
- ✅ Automatic request tracing
- ✅ Type-safe validation
- ✅ Pub/Sub events (BullMQ-based)

## Features

### 🚀 Zero Configuration

Everything works out of the box:
- Vision Dashboard automatically starts
- Tracing middleware auto-installed
- Event bus auto-initialized (BullMQ)
- Service catalog auto-discovered

### 🔥 c.span() Built Into Context

No more `useVisionSpan()` or manual imports:

```typescript
async (data, c) => {
  // Just use c.span()!
  const user = c.span('db.select', { 'db.table': 'users' }, () => {
    return db.users.findOne(data.id)
  })
  
  const posts = c.span('db.select', { 'db.table': 'posts' }, () => {
    return db.posts.findMany({ userId: user.id })
  })
  
  return { user, posts }
}
```

### ✅ Type-Safe Everything

Zod validation for inputs and outputs:

```typescript
.endpoint('POST', '/users', {
  input: z.object({
    name: z.string().min(1),
    email: z.string().email()
  }),
  output: z.object({
    id: z.string()
  })
}, async (data, c) => {
  // data is fully typed!
  return { id: '123' }
})
```

### 📡 Pub/Sub & Cron Built-In

BullMQ event bus is built-in:

```typescript
// Subscribe to events
.on('user/created', async (event) => {
  await sendWelcomeEmail(event.data.email)
})

// Schedule cron jobs
.cron('0 0 * * *', async () => {
  await cleanupInactiveUsers()
})

// Send events from handlers
await c.emit('user/created', { userId: '123', email: 'user@example.com' })
```

### 🎯 Service Builder Pattern

Organize your code by services:

```typescript
app.service('users')
  .on('user/created', handler)
  .endpoint('GET', '/users', schema, handler)
  .endpoint('POST', '/users', schema, handler)
  .cron('0 0 * * *', handler)

app.service('orders')
  .on('order/placed', handler)
  .endpoint('GET', '/orders', schema, handler)
  .endpoint('POST', '/orders', schema, handler)
```

> Note: Declare `service.on('event', { schema, handler })` BEFORE any endpoint that calls `c.emit('event', ...)`.
> This ensures TypeScript can infer the event type for `c.emit`, otherwise you'll get type errors.

### 🔐 Middleware Support

Add middleware globally or per-service:

```typescript
import { logger } from 'hono/logger'
import { jwt } from 'hono/jwt'

// Global middleware
app.use('*', logger())

// Service-level middleware (applies to all endpoints)
app.service('admin')
  .use(jwt({ secret: 'secret' }))  // Protect all admin endpoints
  .endpoint('GET', '/admin/users', schema, handler)
  .endpoint('POST', '/admin/settings', schema, handler)

// Endpoint-level middleware
app.service('users')
  .endpoint('GET', '/users', schema, handler)  // Public
  .endpoint('POST', '/users', schema, handler, {
    middleware: [authMiddleware]  // Protected
  })
```

### 🔮 Vision Dashboard Included

Automatic observability:
- 📊 Real-time request tracing
- 📝 Live logs
- 🏗️ Service catalog
- 🔍 Waterfall visualization
- 📈 Performance metrics

Visit `http://localhost:9500` after starting your app!

## API Reference

### `new Vision(config)`

Create a new Vision app.

```typescript
const app = new Vision({
  service: {
    name: 'My API',
    version: '1.0.0',
    description: 'Optional description',
    integrations: {
      database: 'postgresql://localhost/mydb',  // Optional
      redis: 'redis://localhost:6379'            // Optional
    },
    drizzle: {
      autoStart: true,   // Auto-start Drizzle Studio
      port: 4983         // Drizzle Studio port
    }
  },
  vision: {
    enabled: true,      // Enable/disable dashboard
    port: 9500,         // Dashboard port
    maxTraces: 1000,    // Max traces to store
    maxLogs: 10000,     // Max logs to store
    logging: true       // Console logging
  },
  pubsub: {
    devMode: true      // In-memory BullMQ for local dev
  }
})
```

### `app.service(name)`

Create a new service builder.

```typescript
app.service('users')
  .on(...)
  .endpoint(...)
  .cron(...)
```

### `service.endpoint(method, path, schema, handler, config?)`

Define a type-safe HTTP endpoint.

```typescript
.endpoint(
  'GET',
  '/users/:id',
  {
    input: z.object({ id: z.string() }),
    output: z.object({ id: z.string(), name: z.string() })
  },
  async ({ id }, c) => {
    // handler with c.span() available
    return { id, name: 'John' }
  },
  {
    middleware: [authMiddleware]  // Optional
  }
)
```

### `service.on(eventName, handler)`

Subscribe to events.

```typescript
.on('user/created', async (event) => {
  console.log(event.data)
})
```

### `service.cron(schedule, handler, options?)`

Schedule a cron job.

```typescript
.cron('0 0 * * *', async () => {
  console.log('Daily job')
}, { id: 'custom-id' })
```

### `c.span(name, attributes, fn)`

Create a custom span (built into context).

```typescript
const result = c.span('operation.name', {
  'attribute.key': 'value'
}, () => {
  // Your code here
  return someResult
})
```

### Event emission

Emit events from handlers using the context:

```typescript
await c.emit('user/created', { userId: '123', email: 'user@example.com' })
```

### `app.getVision()`

Get the VisionCore instance.

```typescript
const vision = app.getVision()
const tracer = vision.getTracer()
```

### `app.start(port, options?)`

Start the server (convenience method).

```typescript
await app.start(3000)
// or
await app.start(3000, { hostname: '0.0.0.0' })
```

## Drizzle Integration

Vision Server automatically detects and integrates with Drizzle ORM.

### Auto-Start Drizzle Studio

```typescript
const app = new Vision({
  service: {
    name: 'My API',
    integrations: {
      database: 'sqlite://./dev.db'
    },
    drizzle: {
      autoStart: true,  // Start Drizzle Studio automatically
      port: 4983        // Default: 4983
    }
  }
})
```

**What happens:**
1. ✅ Detects `drizzle.config.ts` in your project
2. ✅ Auto-starts Drizzle Studio on port 4983
3. ✅ Displays in Vision Dashboard → Integrations
4. ✅ Links to https://local.drizzle.studio

### Use with c.span()

```typescript
app.service('users')
  .endpoint('GET', '/users/:id', schema, async ({ id }, c) => {
    // Trace database queries
    const user = c.span('db.select', {
      'db.system': 'sqlite',
      'db.table': 'users'
    }, () => {
      return db.select().from(users).where(eq(users.id, id)).get()
    })
    
    return user
  })
```

## Hono Compatibility

Vision extends Hono, so all Hono features work:

```typescript
// Use any Hono middleware
app.use('*', logger())
app.use('*', cors())
app.use('/admin/*', jwt({ secret: 'secret' }))

// Define routes Hono-style
app.get('/health', (c) => c.json({ status: 'ok' }))

// Use Hono routing features
app.route('/api/v1', apiRoutes)

// Access Hono methods
app.notFound((c) => c.json({ error: 'Not found' }, 404))
app.onError((err, c) => c.json({ error: err.message }, 500))
```

## Complete Example

Here's a full working example with multiple services, pub/sub, and Drizzle:

```typescript
import { Vision } from '@getvision/server'
import { z } from 'zod'
import { db } from './db'
import { users, orders } from './db/schema'
import { eq } from 'drizzle-orm'

const app = new Vision({
  service: {
    name: 'E-Commerce API',
    version: '1.0.0',
    integrations: {
      database: 'sqlite://./dev.db'
    },
    drizzle: {
      autoStart: true,
      port: 4983
    }
  },
  vision: {
    enabled: true,
    port: 9500
  },
  pubsub: {
    schemas: {
      'user/created': {
        data: z.object({
          userId: z.string(),
          email: z.string().email()
        })
      },
      'order/placed': {
        data: z.object({
          orderId: z.string(),
          userId: z.string(),
          total: z.number()
        })
      }
    }
  }
})

// User Service
app.service('users')
  .endpoint('GET', '/users', {
    input: z.object({}),
    output: z.object({
      users: z.array(z.object({
        id: z.string(),
        name: z.string()
      }))
    })
  }, async (_, c) => {
    const allUsers = c.span('db.select', { 'db.table': 'users' }, () => {
      return db.select().from(users).all()
    })
    return { users: allUsers }
  })
  .on('user/created', async (event) => {
    console.log('Sending welcome email to:', event.data.email)
  })
  .endpoint('POST', '/users', {
    input: z.object({
      name: z.string().min(1),
      email: z.string().email()
    }),
    output: z.object({ id: z.string() })
  }, async (data, c) => {
    const user = c.span('db.insert', { 'db.table': 'users' }, () => {
      return db.insert(users).values(data).returning().get()
    })
    
    // Emit event (type-safe)
    await c.emit('user/created', { userId: user.id, email: user.email })
    
    return { id: user.id }
  })

// Order Service
app.service('orders')
  .endpoint('POST', '/orders', {
    input: z.object({
      userId: z.string(),
      items: z.array(z.object({
        productId: z.string(),
        quantity: z.number()
      }))
    }),
    output: z.object({ orderId: z.string() })
  }, async (data, c) => {
    const order = c.span('db.insert', { 'db.table': 'orders' }, () => {
      return db.insert(orders).values({
        userId: data.userId,
        total: 100
      }).returning().get()
    })
    
    return { orderId: order.id }
  })
  .cron('0 0 * * *', async () => {
    console.log('Daily order summary')
  })

app.start(3000)
```

### Run the Example

```bash
# From project root
bun run example:server

# Or directly
cd examples/vision
bun run dev
```

Visit:
- **API:** http://localhost:3000
- **Vision Dashboard:** http://localhost:9500
- **Drizzle Studio:** https://local.drizzle.studio

## Why Vision Server?

### ✅ Advantages

**vs NestJS:**
- 10x faster (Hono vs Express)
- 10x simpler (no DI, no decorators)
- Built-in observability

**vs Encore.ts:**
- 100% open source (MIT)
- No vendor lock-in
- Deploy anywhere

**vs Plain Hono:**
- Built-in observability
- Type-safe validation
- Pub/Sub & Cron included
- Better code organization

### 🎯 Perfect For

- Greenfield projects
- API-first architectures
- Teams that want great DX
- Projects that need observability
- Anyone who wants NestJS features without the complexity

## Roadmap

- [x] Drizzle integration with auto-start Studio
- [x] Type-safe validation with Zod
- [x] Auto-generated API schemas
- [ ] Cache layer (Redis integration)
- [ ] Rate limiting (per-endpoint & global)
- [ ] Testing helpers
- [ ] OpenAPI generation
- [ ] WebSocket support

## License

MIT

---

**Built with ❤️ by the Vision team**
