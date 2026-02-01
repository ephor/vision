# Vision Server Example

Build APIs with observability from the start. Vision Server is a meta-framework with tracing, events, and cron jobs built in.

## Quick Start

```bash
bun install
bun dev
```

**Open:**
- API: http://localhost:3000
- Vision Dashboard: http://localhost:9500
- Inngest Dev Server: http://localhost:8288 (if installed)

No Redis, no external services. Everything runs locally.

## Try This: See the Service Builder Pattern

**Step 1:** Look at the code

```typescript
app.service('users')
  .endpoint('GET', '/users/:id', {
    input: z.object({ id: z.string() }),
    output: z.object({ id: z.string(), name: z.string() })
  }, async ({ id }, c) => {
    // c.span() is built in - no imports needed
    const user = c.span('db.select', { 'db.table': 'users' }, () => {
      return db.select().from(users).where(eq(users.id, id))
    })
    return user
  })
```

**Step 2:** Make a request

```bash
curl http://localhost:3000/users/1
```

**Step 3:** Open Vision Dashboard

You'll see the trace with the `db.select` span already tracked. No extra setup.

## Try This: See Events in Action

**Step 1:** Create a user

```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com"}'
```

**Step 2:** Check the console

You'll see: `📧 Sending welcome email to: alice@example.com`

**Step 3:** Open Vision Dashboard

In the trace, you'll see:
- The HTTP request
- The database insert
- The event being sent

## Try This: Create an Order

**Step 1:** Create an order

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "1",
    "items": [{"productId": "prod_1", "quantity": 2}],
    "total": 99.99
  }'
```

**Step 2:** Open Vision Dashboard

You'll see the complete trace with all database operations and events.

## When to Use Vision Server vs Adapters

| Use Vision Server when: | Use Adapters when: |
|------------------------|-------------------|
| Starting a new project | Adding to existing app |
| Want structured services | Want minimal changes |
| Need events + cron jobs | Just need tracing |
| Building from scratch | Have existing routes |

Both give you the same dashboard. Vision Server just has more built in.

## Service Organization

```
Users Service
  GET /users        - List all users
  GET /users/:id    - Get user with related articles
  POST /users       - Create user (triggers event)

Orders Service
  POST /orders      - Create order

Root
  GET /             - API info
```

## How Vision Server Works

### 1. Service Builder Pattern

```typescript
const userService = app.service('users')
  .endpoint(method, path, { input, output }, handler)
  .on('event-name', eventHandler)
  .cron('schedule', cronHandler)
```

### 2. Built-in Spans

The handler context has `span()` built in:

```typescript
async ({ id }, c) => {
  // c.span() - no import needed
  const user = c.span('db.select', { 'db.table': 'users' }, () => {
    return db.select().from(users)
  })
  return user
}
```

### 3. Type-safe Validation

Input and output are validated and typed:

```typescript
.endpoint('POST', '/users', {
  input: z.object({
    name: z.string().min(1),
    email: z.string().email()
  }),
  output: z.object({
    id: z.string()
  })
}, async (data) => {
  // data is typed as { name: string, email: string }
  return { id: '123' }
})
```

### 4. Event Handlers

Handle events with type safety:

```typescript
.on('user/created', async (event) => {
  // event.data is typed based on schema
  console.log('Welcome email to:', event.data.email)
})
```

### 5. Cron Jobs

Schedule recurring tasks:

```typescript
.cron('0 0 * * *', async () => {
  console.log('Daily cleanup running...')
})
```

## API Endpoints

```bash
# API info
curl http://localhost:3000/

# List users
curl http://localhost:3000/users

# Get user by ID (includes articles)
curl http://localhost:3000/users/1

# Create user (triggers welcome email event)
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com"}'

# Create order
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"userId":"1","items":[{"productId":"p1","quantity":2}],"total":99.99}'
```

## Event System

Vision Server uses Inngest for events:

```typescript
// Define event schemas
pubsub: {
  schemas: {
    'user/created': {
      data: z.object({
        userId: z.string(),
        email: z.string().email()
      })
    }
  }
}

// Send events
await app.getInngest().send({
  name: 'user/created',
  data: { userId: '123', email: 'alice@example.com' }
})

// Handle events
.on('user/created', async (event) => {
  await sendWelcomeEmail(event.data.email)
})
```

## File-Based Routing

Vision Server supports file-based routing like Next.js:

```
app/routes/
├── products/
│   └── index.ts     → /products
├── users/
│   └── [id]/
│       └── index.ts → /users/:id
└── analytics/
    └── dashboard/
        └── index.ts → /analytics/dashboard
```

Each file exports a Vision instance:

```typescript
// app/routes/products/index.ts
import { Vision } from '@getvision/server'

const app = new Vision()

app.service('products')
  .endpoint('GET', '/', {...}, listProducts)

export default app
```

## Troubleshooting

### Inngest not starting

Install the CLI:
```bash
brew install inngest/tap/inngest
```

Or disable auto-start:
```typescript
const app = new Vision({
  inngest: { autoStart: false }
})
```

### Events not appearing

1. Check Inngest Dev Server is running (localhost:8288)
2. Check app logs for "Inngest Dev Server running"
3. Verify INNGEST_DEV=1 in environment

## Next Steps

- Build your own service with `app.service('name')`
- Add event handlers with `.on('event', handler)`
- Schedule tasks with `.cron('schedule', handler)`
- Check out the [Vision Server docs](https://getvision.dev/docs/server)
- See [debugging workflows](https://getvision.dev/docs/debugging)
