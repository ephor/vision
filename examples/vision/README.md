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

No Redis, no external services. Everything runs locally with in-memory BullMQ.

## Try This: Use the API Explorer

**Step 1:** Open Vision Dashboard (localhost:9500)

**Step 2:** Go to **API Explorer** tab

You'll see all your endpoints auto-discovered:
- `GET /users` - List users
- `GET /users/:id` - Get user
- `POST /users` - Create user
- `POST /orders` - Create order

**Step 3:** Click `POST /users`

Vision auto-generates a request template from your Zod schema:

```json
{
  "name": "",   // string (required)
  "email": ""   // email (required)
}
```

**Step 4:** Fill in and send

Click Send. The response appears, and a new trace is created automatically.

**No curl needed.** The API Explorer knows your schemas and generates templates.

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

**Step 2:** Make a request (via API Explorer or curl)

**Step 3:** Open **Traces** tab

You'll see the trace with the `db.select` span already tracked. No extra setup.

## Try This: See Events in Action

**Step 1:** Create a user via API Explorer

Go to `POST /users`, fill in name and email, click Send.

**Step 2:** Check the console

You'll see: `📧 Sending welcome email to: alice@example.com`

**Step 3:** Open **Traces** tab

In the trace, you'll see:
- The HTTP request
- The database insert
- The event being processed

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

### 4. Event Handlers (BullMQ)

Handle events with type safety:

```typescript
.on('user/created', async (event) => {
  // event.data is typed based on schema
  console.log('Welcome email to:', event.data.email)
})
```

### 5. Cron Jobs (BullMQ)

Schedule recurring tasks:

```typescript
.cron('0 0 * * *', async () => {
  console.log('Daily cleanup running...')
})
```

## Event System

Vision Server uses BullMQ for events (in-memory during development):

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

// Send events from handler
.endpoint('POST', '/users', schema, async (data, c) => {
  const user = await createUser(data)

  // Emit event (type-safe!)
  await c.emit('user/created', {
    userId: user.id,
    email: user.email
  })

  return user
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

## API Explorer Features

The API Explorer in Vision Dashboard:

- **Auto-discovers** all your endpoints
- **Generates templates** from Zod schemas
- **Shows validation** errors inline
- **Saves history** of requests
- **Supports** path params, query params, headers, body

Much easier than writing curl commands!

## Next Steps

- Build your own service with `app.service('name')`
- Add event handlers with `.on('event', handler)`
- Schedule tasks with `.cron('schedule', handler)`
- Check out the [Vision Server docs](https://getvision.dev/docs/server)
- See [debugging workflows](https://getvision.dev/docs/debugging)
