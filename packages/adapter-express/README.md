# @getvision/adapter-express

Express.js adapter for Vision Dashboard.

## Installation

```bash
bun add @getvision/adapter-express
# or
npm install @getvision/adapter-express
```

## Quick Start

```typescript
import express from 'express'
import { visionMiddleware, enableAutoDiscovery, zValidator } from '@getvision/adapter-express'
import { z } from 'zod'

const app = express()

// Add Vision middleware (development only)
if (process.env.NODE_ENV === 'development') {
  app.use(visionMiddleware({ port: 9500 }))
}

// JSON parser
app.use(express.json())

// Your routes
app.get('/users', (req, res) => {
  res.json({ users: [] })
})

// Zod validation (typed + auto-documented in Vision)
const createUser = z.object({
  name: z.string().min(1).describe('Full name'),
  email: z.string().email().describe('Email'),
  age: z.number().int().positive().optional().describe('Age (optional)'),
})

app.post('/users', zValidator('body', createUser), (req, res) => {
  res.status(201).json(req.body)
})

// Enable auto-discovery after routes
if (process.env.NODE_ENV === 'development') {
  // Auto-group routes by first path segment (Users, Root, etc.)
enableAutoDiscovery(app)

// Or provide manual services grouping with glob-like patterns
// e.g. `/users/*` → "Users" service
//      `/auth/*`  → "Auth" service
//      Unmatched  → "Uncategorized"
//
// enableAutoDiscovery(app, { services: [
//   { name: 'Users', description: 'User management', routes: ['/users/*'] },
//   { name: 'Auth', routes: ['/auth/*'] }
// ]})
}

app.listen(3000)
```

Visit `http://localhost:9500` to see the dashboard! 🎉

## Features

### Automatic Request Tracing
Every request is automatically traced with:
- HTTP method, path, query params
- Request/response headers and body (captured before/after send)
- Status code and duration
- Response capture
 - Root `http.request` span with child spans (DB, etc.)

### Custom Spans
Track operations within requests:

```typescript
import { useVisionSpan } from '@getvision/adapter-express'

app.get('/users', async (req, res) => {
  const withSpan = useVisionSpan()
  
  const users = withSpan('db.query', {
    'db.system': 'postgresql',
    'db.table': 'users'
  }, () => {
    return db.select().from(users).all()
  })
  
  res.json({ users })
})
```

### Auto-Discovery (Services Catalog)
Automatically discover all routes:

```typescript
enableAutoDiscovery(app)
```

This will register all routes with Vision for the service catalog.

## API

### `visionMiddleware(options?)`

Express middleware for Vision.

**Options:**
```typescript
interface VisionExpressOptions {
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

Enable automatic route discovery for Express app.

**Note:** Call this after all routes are defined.

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
import { getVisionContext } from '@getvision/adapter-express'

app.get('/debug', (req, res) => {
  const { vision, traceId } = getVisionContext()
  res.json({ traceId })
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
# The middleware auto-sets:
#   Access-Control-Allow-Origin: *
#   Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
#   Access-Control-Allow-Headers: Content-Type, Authorization, X-Vision-Trace-Id, X-Vision-Session
#   Access-Control-Expose-Headers: X-Vision-Trace-Id, X-Vision-Session
```

## Example

See [examples/express-basic](../../examples/express) for a complete example.

## Integration with ORMs

### Prisma

```typescript
app.get('/users', async (req, res) => {
  const withSpan = useVisionSpan()
  
  const users = await withSpan('db.query', {
    'db.system': 'postgresql',
    'db.operation': 'findMany'
  }, async () => {
    return await prisma.user.findMany()
  })
  
  res.json({ users })
})
```

### TypeORM

```typescript
app.get('/users', async (req, res) => {
  const withSpan = useVisionSpan()
  
  const users = await withSpan('db.query', {
    'db.system': 'postgresql',
    'db.table': 'users'
  }, async () => {
    return await userRepository.find()
  })
  
  res.json({ users })
})
```

## TypeScript

Full TypeScript support included.

```typescript
import type { VisionExpressOptions } from '@getvision/adapter-express'

const options: VisionExpressOptions = {
  port: 9500,
  service: {
    name: 'my-api',
    version: '1.0.0'
  }
}
```

## License

MIT
