# @getvision/adapter-fastify

Fastify adapter for Vision Dashboard.

## Installation

```bash
bun add @getvision/adapter-fastify fastify-type-provider-zod
# or
npm install @getvision/adapter-fastify fastify-type-provider-zod
```

**Note:** `fastify-type-provider-zod` is required for Zod schema validation.

## Quick Start

```typescript
import Fastify from 'fastify'
import { visionPlugin, enableAutoDiscovery } from '@getvision/adapter-fastify'
import { z } from 'zod'
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod'

const app = Fastify()

// Add Zod validator and serializer
app.setValidatorCompiler(validatorCompiler)
app.setSerializerCompiler(serializerCompiler)

// Register Vision plugin (development only)
if (process.env.NODE_ENV === 'development') {
  await app.register(visionPlugin, { port: 9500 })
}

// Routes
app.get('/users', async (request, reply) => {
  return { users: [] }
})

// Zod validation with Fastify type provider
const CreateUserSchema = z.object({
  name: z.string().min(1).describe('Full name'),
  email: z.string().email().describe('Email'),
  age: z.number().int().positive().optional().describe('Age (optional)'),
})

app.withTypeProvider<ZodTypeProvider>().post('/users', {
  schema: {
    body: CreateUserSchema
  }
}, async (request, reply) => {
  return { id: 1, ...request.body }
})

// Enable auto-discovery after routes
if (process.env.NODE_ENV === 'development') {
  enableAutoDiscovery(app)
}

await app.listen({ port: 3000 })
```

Visit `http://localhost:9500` to see the dashboard! 🎉

## Features

### Automatic Request Tracing
Every request is automatically traced with:
- HTTP method, path, query params
- Request/response headers and body
- Status code and duration
- Root `http.request` span with child spans (DB, etc.)

### Custom Spans
Track operations within requests:

```typescript
import { useVisionSpan } from '@getvision/adapter-fastify'

app.get('/users', async (request, reply) => {
  const withSpan = useVisionSpan()
  
  const users = withSpan('db.select', {
    'db.system': 'postgresql',
    'db.table': 'users'
  }, () => {
    return db.select().from(users).all()
  })
  
  return { users }
})
```

### Auto-Discovery (Services Catalog)
Automatically discover all routes:

```typescript
// Auto-group routes by first path segment (Users, Root, etc.)
enableAutoDiscovery(app)

// Or provide manual services grouping with glob-like patterns
enableAutoDiscovery(app, {
  services: [
    { name: 'Users', description: 'User management', routes: ['/users/*'] },
    { name: 'Auth', routes: ['/auth/*'] }
  ]
})
```

## API

### `visionPlugin(options?)`

Fastify plugin for Vision.

**Options:**
```typescript
interface VisionFastifyOptions {
  port?: number              // Dashboard port (default: 9500)
  enabled?: boolean          // Enable Vision (default: true)
  maxTraces?: number         // Max traces to store (default: 1000)
  maxLogs?: number           // Max logs to store (default: 10000)
  logging?: boolean          // Console logging (default: true)
  cors?: boolean             // Auto CORS for dashboard (default: true)
  service?: {
    name?: string            // Service name
    version?: string         // Service version
    description?: string     // Service description
    integrations?: {
      database?: string      // Database connection
      redis?: string         // Redis connection
      [key: string]: string | undefined
    }
  }
}
```

### `enableAutoDiscovery(app, options?)`

Enable automatic route discovery for Fastify app.

**Note:** Call this after all routes are registered.

```ts
type ServiceDefinition = {
  name: string
  description?: string
  routes: string[] // e.g. ['/users/*']
}

enableAutoDiscovery(app, {
  services: [
    { name: 'Users', routes: ['/users/*'] },
  ]
})
```

### `useVisionSpan()`

Get span helper for current request. Child spans are automatically parented to the root `http.request` span for the current request.

**Returns:** `(name, attributes, fn) => result`

```typescript
const withSpan = useVisionSpan()

const result = withSpan('operation.name', {
  'attr.key': 'value'
}, () => {
  // Your operation
  return result
})
```

### `getVisionContext()`

Get current Vision context.

**Returns:** `{ vision: VisionCore, traceId: string, rootSpanId: string }`

```typescript
import { getVisionContext } from '@getvision/adapter-fastify'

app.get('/debug', async (request, reply) => {
  const { vision, traceId } = getVisionContext()
  return { traceId }
})
```

### `getVisionInstance()`

Get the global Vision instance.

**Returns:** `VisionCore | null`

## Environment Variables

```bash
VISION_ENABLED=true        # Enable/disable Vision
VISION_PORT=9500           # Dashboard port
NODE_ENV=development       # Environment

# CORS notes
# Dashboard adds/needs headers: X-Vision-Trace-Id, X-Vision-Session
# The plugin auto-sets:
#   Access-Control-Allow-Origin: *
#   Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
#   Access-Control-Allow-Headers: Content-Type, Authorization, X-Vision-Trace-Id, X-Vision-Session
#   Access-Control-Expose-Headers: X-Vision-Trace-Id, X-Vision-Session
```

## Fastify-Specific Features

### Hooks Lifecycle

Vision uses Fastify hooks for tracing:
- `onRequest` - Create trace, start root span, add CORS headers
- `preHandler` - Run in AsyncLocalStorage context
- `onResponse` - Complete trace, end span, broadcast to dashboard

### Schema Support

Fastify's native schema support works with Zod:

```typescript
import { z } from 'zod'

const schema = z.object({
  name: z.string(),
  email: z.string().email()
})

app.post('/users', {
  schema: {
    body: schema
  }
}, async (request, reply) => {
  // request.body is validated
  return request.body
})
```

Vision automatically extracts the schema and generates JSON templates for API Explorer.

## Integration with ORMs

### Prisma

```typescript
app.get('/users', async (request, reply) => {
  const withSpan = useVisionSpan()
  
  const users = await withSpan('db.query', {
    'db.system': 'postgresql',
    'db.operation': 'findMany'
  }, async () => {
    return await prisma.user.findMany()
  })
  
  return { users }
})
```

### Drizzle

```typescript
app.get('/users', async (request, reply) => {
  const withSpan = useVisionSpan()
  
  const users = await withSpan('db.select', {
    'db.system': 'postgresql',
    'db.table': 'users'
  }, async () => {
    return await db.select().from(users)
  })
  
  return { users }
})
```

## TypeScript

Full TypeScript support included.

```typescript
import type { VisionFastifyOptions } from '@getvision/adapter-fastify'

const options: VisionFastifyOptions = {
  port: 9500,
  service: {
    name: 'my-api',
    version: '1.0.0'
  }
}
```

## License

MIT
