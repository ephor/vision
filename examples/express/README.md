# Express + Vision Example

Add Vision to your Express app in 2 lines. See exactly what happens inside every request.

## Quick Start

```bash
bun install
bun dev
```

**Open:**
- API: http://localhost:3000
- Vision Dashboard: http://localhost:9500

## Try This: See Your First Trace

**Step 1:** Make a request

```bash
curl http://localhost:3000/users
```

**Step 2:** Open Vision Dashboard (localhost:9500)

Click the trace for `GET /users`. You'll see:

```
GET /users (35ms)
├── http.request (35ms)
│   └── db.select (8ms)
│       └── db.table: "users"
│       └── db.system: "mock"
```

**That's it.** No console.log needed. You see exactly what happened, how long each step took, and what was returned.

## Try This: Debug a Validation Error

**Step 1:** Send a bad request

```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"","email":"invalid"}'
```

**Step 2:** Find the 400 trace in Vision Dashboard

You'll see:
- The exact request body that was sent
- Which validation rule failed
- The error message

No guessing. No adding logs. Just click and see.

## Try This: Track Custom Operations

**Step 1:** Look at the code in `src/index.ts`

```typescript
const withSpan = useVisionSpan()

const users = withSpan('db.select', {
  'db.table': 'users',
  'db.system': 'mock'
}, () => {
  return mockDb.users
})
```

**Step 2:** Make a request and see the span in the trace

Every operation you wrap in `withSpan()` appears in the waterfall. This is how you track:
- Database queries
- External API calls
- Cache operations
- Anything else

## How to Add Vision to Your Express App

**Step 1:** Install

```bash
npm install @getvision/adapter-express
```

**Step 2:** Add 2 lines

```typescript
import express from 'express'
import { visionMiddleware, enableAutoDiscovery } from '@getvision/adapter-express'

const app = express()

// Add these 2 lines
app.use(visionMiddleware())
enableAutoDiscovery(app)

// Your existing routes work as-is
app.get('/users', (req, res) => {
  res.json([{ id: 1, name: 'Alice' }])
})

app.listen(3000)
```

**Step 3:** Open localhost:9500

Your requests are now traced automatically.

## API Endpoints

```bash
# Get API info
curl http://localhost:3000/

# List users
curl http://localhost:3000/users

# Get user by ID
curl http://localhost:3000/users/1

# Create user (with validation)
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com"}'

# Update user
curl -X PUT http://localhost:3000/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice Updated"}'

# Delete user
curl -X DELETE http://localhost:3000/users/1
```

## Adding Custom Spans

Track any operation:

```typescript
import { useVisionSpan } from '@getvision/adapter-express'

app.get('/orders/:id', (req, res) => {
  const withSpan = useVisionSpan()

  // Track database query
  const order = withSpan('db.select', {
    'db.table': 'orders',
    'db.id': req.params.id
  }, () => {
    return db.query('SELECT * FROM orders WHERE id = ?', [req.params.id])
  })

  // Track external API call
  const shipping = withSpan('external.api', {
    'api.name': 'shipping',
    'order.id': order.id
  }, async () => {
    return fetch(`https://shipping.api/track/${order.trackingId}`)
  })

  res.json({ order, shipping })
})
```

## Adding Validation

Use the `validator` middleware with Zod schemas:

```typescript
import { validator } from '@getvision/adapter-express'
import { z } from 'zod'

const CreateUserSchema = z.object({
  name: z.string().min(1).describe('Full name'),
  email: z.string().email().describe('Email address')
})

app.post('/users',
  validator('body', CreateUserSchema),
  (req, res) => {
    // req.body is typed and validated
    res.json({ id: '123', ...req.body })
  }
)
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
- console.log output (linked to trace)

## Next Steps

- Add Vision to your own Express app
- Add custom spans for your database queries
- Check out the [debugging workflows](https://getvision.dev/docs/debugging)
- See [common patterns](https://getvision.dev/docs/patterns) for best practices
