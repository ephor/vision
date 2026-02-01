# Fastify + Vision Example

Add Vision to your Fastify app as a plugin. See exactly what happens inside every request.

## Quick Start

```bash
bun install
bun dev
```

**Open:**
- API: http://localhost:3000
- Vision Dashboard: http://localhost:9500

## Try This: Use the API Explorer

**Step 1:** Open Vision Dashboard (localhost:9500)

**Step 2:** Go to **API Explorer** tab

All endpoints are auto-discovered. Click any endpoint to see the request template.

**Step 3:** Click `POST /users`

Vision generates a template from your Zod schema. Fill it in and click Send.

**No curl needed** - but curl examples are below if you prefer.

## Try This: See Your First Trace

**Step 1:** Make a request via API Explorer or curl

```bash
curl http://localhost:3000/users/1
```

**Step 2:** Open **Traces** tab

Click the trace for `GET /users/1`. You'll see:

```
GET /users/1 (42ms)
├── http.request (42ms)
│   ├── db.select.users (8ms)
│   └── db.select.articles (15ms)
```

**You immediately see:** Two database queries, and `articles` takes longer than `users`.

## Try This: Debug a Validation Error

**Step 1:** Send an invalid request

```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"A","email":"not-valid","age":"young"}'
```

**Step 2:** Find the 400 trace in Vision Dashboard

You'll see:
- **Request Body:** `{"name":"A","email":"not-valid","age":"young"}`
- **Validation Errors:**
  - `name`: String must contain at least 2 characters
  - `email`: Invalid email
  - `age`: Expected number, received string

No console.log. No guessing. Just click and see.

## Try This: Compare Traces

Make two similar requests and compare them in the dashboard:

```bash
# Fast request
curl http://localhost:3000/users/1

# Slow request (simulated)
curl http://localhost:3000/users/1?slow=true
```

In Vision Dashboard, you can see both traces side by side and compare:
- Which spans are different
- Where time is spent
- What changed

## How to Add Vision to Your Fastify App

**Step 1:** Install

```bash
npm install @getvision/adapter-fastify
```

**Step 2:** Register the plugin

```typescript
import fastify from 'fastify'
import { visionPlugin, enableAutoDiscovery } from '@getvision/adapter-fastify'

const app = fastify()

// Register Vision plugin
await app.register(visionPlugin)
enableAutoDiscovery(app)

// Your existing routes work as-is
app.get('/users', async () => {
  return [{ id: 1, name: 'Alice' }]
})

await app.listen({ port: 3000 })
```

**Step 3:** Open localhost:9500

Your requests are now traced automatically.

## API Endpoints

```bash
# Get API info
curl http://localhost:3000/

# List users
curl http://localhost:3000/users

# Get user by ID (multiple spans)
curl http://localhost:3000/users/1

# Create user (with validation)
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice Smith","email":"alice@example.com","age":25}'

# Update user
curl -X PUT http://localhost:3000/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice Updated"}'

# Delete user
curl -X DELETE http://localhost:3000/users/1
```

## Adding Custom Spans

Track any operation with Fastify's request context:

```typescript
import { useVisionSpan } from '@getvision/adapter-fastify'

app.get('/orders/:id', async (request, reply) => {
  const withSpan = useVisionSpan(request)

  // Track database query
  const order = await withSpan('db.select', {
    'db.table': 'orders',
    'order.id': request.params.id
  }, async () => {
    return db.query('SELECT * FROM orders WHERE id = ?', [request.params.id])
  })

  // Track external API call
  const tracking = await withSpan('external.shipping', {
    'tracking.id': order.trackingId
  }, async () => {
    return fetch(`https://shipping.api/track/${order.trackingId}`)
  })

  return { order, tracking }
})
```

## Adding Validation

Fastify's schema validation works with Vision:

```typescript
import { z } from 'zod'

const CreateUserSchema = z.object({
  name: z.string().min(2).describe('Full name'),
  email: z.string().email().describe('Email address'),
  age: z.number().min(0).optional().describe('Age in years')
})

app.post('/users', {
  schema: {
    body: CreateUserSchema
  }
}, async (request) => {
  // request.body is validated and typed
  return { id: '123', ...request.body }
})
```

Vision extracts the schema and:
- Shows it in the API Explorer
- Generates request templates
- Displays validation errors in traces

## What Vision Captures

For every request:
- HTTP method, path, status code
- Request headers and body
- Response headers and body
- Custom spans with timing
- Errors with stack traces
- Fastify lifecycle hooks

## Fastify-Specific Features

### Automatic Hook Tracking

Vision automatically tracks Fastify's lifecycle:
- `onRequest` hooks
- `preHandler` hooks
- `onResponse` hooks

### Request Context

Use Fastify's request context for spans:

```typescript
const withSpan = useVisionSpan(request)
```

### Validation PreHandler

Add validation as a preHandler:

```typescript
import { validator } from '@getvision/adapter-fastify'

app.post('/users', {
  preHandler: [validator('body', CreateUserSchema)]
}, handler)
```

## Next Steps

- Add Vision to your own Fastify app
- Add custom spans for your database queries
- Check out the [debugging workflows](https://getvision.dev/docs/debugging)
- See [common patterns](https://getvision.dev/docs/patterns) for best practices
