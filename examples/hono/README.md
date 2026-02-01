# Hono + Vision + Drizzle Example

See exactly what happens inside your API. This example shows Vision with a real database.

## Quick Start

```bash
bun install
bun run db:push
bun dev
```

**Open:**
- API: http://localhost:3000
- Vision Dashboard: http://localhost:9500
- Drizzle Studio: http://localhost:4983

## Try This: Debug a Slow Query

**Step 1:** Create some data

```bash
# Create a few users
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com"}'

curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Bob","email":"bob@example.com"}'
```

**Step 2:** Make a request

```bash
curl http://localhost:3000/users/1
```

**Step 3:** Open Vision Dashboard (localhost:9500)

Click the trace for `GET /users/1`. You'll see:

```
GET /users/1 (45ms)
├── http.request (45ms)
│   └── db.select (12ms)
│       └── db.table: "users"
│       └── db.system: "sqlite"
```

**What you learn:** The database query took 12ms out of 45ms total. If this was slow, you'd see exactly which operation is the bottleneck.

## Try This: Debug a Validation Error

**Step 1:** Send an invalid request

```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"","email":"not-an-email"}'
```

**Step 2:** Open Vision Dashboard

Find the trace with status 400. Click it to see:

- **Request Body:** What was actually sent
- **Validation Error:** Which field failed and why
- **Schema:** The expected format

No more guessing what went wrong.

## Try This: See the Full Request Journey

**Step 1:** Make a request

```bash
curl -X PUT http://localhost:3000/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice Updated","email":"alice@example.com"}'
```

**Step 2:** Open Vision Dashboard and click the trace

You'll see the complete waterfall:
- When the request arrived
- How long each database query took
- What was returned
- Total time

## What's Included

- **Vision Dashboard** - Request tracing and debugging
- **Drizzle ORM** - Type-safe SQLite database
- **Drizzle Studio** - Database browser (auto-started)
- **Full CRUD API** - Create, read, update, delete users

## API Endpoints

```bash
# List all users
curl http://localhost:3000/users

# Get user by ID
curl http://localhost:3000/users/1

# Create user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com"}'

# Update user
curl -X PUT http://localhost:3000/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice Updated","email":"alice@example.com"}'

# Delete user
curl -X DELETE http://localhost:3000/users/1
```

## How It Works

### Adding Custom Spans

Track any operation in the waterfall:

```typescript
import { useVisionSpan } from '@getvision/adapter-hono'

app.get('/users/:id', async (c) => {
  const withSpan = useVisionSpan()

  // This appears as a span in the trace
  const user = withSpan('db.select', {
    'db.table': 'users',
    'db.system': 'sqlite'
  }, () => {
    return db.select().from(users).where(eq(users.id, id)).get()
  })

  return c.json(user)
})
```

### What Vision Captures

Every request automatically includes:
- HTTP method, path, status code
- Request/response headers and body
- Query parameters
- Timing for each span
- Any errors with stack traces

## Database

Schema (`src/db/schema.ts`):
```typescript
users {
  id: integer (primary key)
  name: text
  email: text (unique)
  createdAt: timestamp
}
```

Commands:
```bash
bun run db:generate  # Generate migrations
bun run db:push      # Push schema to DB
bun run db:studio    # Open Drizzle Studio manually
```

## Next Steps

- Open Vision Dashboard and explore
- Try breaking something and see how Vision shows the error
- Add custom spans to your own code
- Check out the [debugging workflows](https://getvision.dev/docs/debugging)
