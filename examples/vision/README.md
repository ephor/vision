# Vision SDK - Basic Example

Example app demonstrating `@getvision/sdk` - meta-framework with built-in observability.

## Features Demonstrated

- ✅ **Builder Pattern API** - Encore-style service definitions
- ✅ **Built-in Vision Dashboard** - Automatic tracing & logging
- ✅ **Type-safe Validation** - Zod schemas for inputs/outputs
- ✅ **Custom Spans** - Database query tracking
- ✅ **Event-Driven Architecture** - BullMQ event system
- ✅ **Cron Jobs** - Scheduled tasks with BullMQ Repeatable
- ✅ **Type-safe Events** - Zod validation for events
- ✅ **Multiple Services** - Users and Orders services

## Quick Start

### 1. Install dependencies

```bash
bun install
```

### 2. Run the example

```bash
bun run dev
```

This starts everything automatically:
- 🚀 API Server on `http://localhost:3000`
- 🔮 Vision Dashboard on `http://localhost:9500`
- 📬 Event Bus (BullMQ) - in-memory dev mode, no Redis required!

**That's it!** No external services needed. Everything runs locally.

## Try It Out

### 1. Visit the API

```bash
curl http://localhost:3000
```

### 2. Get all users

```bash
curl http://localhost:3000/users
```

### 3. Get user by ID (with nested spans!)

```bash
curl http://localhost:3000/users/1
```

### 4. Create a user (triggers event!)

```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com"}'
```

### 5. Create an order

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "1",
    "items": [{"productId": "prod_1", "quantity": 2}],
    "total": 99.99
  }'
```

### 6. Open Vision Dashboard

Visit `http://localhost:9500` to see:
- 📊 **Real-time traces** with waterfall visualization
- 📝 **Live logs** from your app
- 🏗️ **Service catalog** with auto-discovered endpoints
- 🔍 **Request details** - headers, body, query params, spans
- ⚡ **Events & Cron Jobs** - Monitor your event-driven architecture at `/events`

## What You'll See

### Service Organization

```
Users Service
  GET /users
  GET /users/:id
  POST /users

Orders Service
  POST /orders

Root
  GET /

Inngest
  POST /api/inngest
```

### Trace Waterfall

When you call `GET /users/:id`, you'll see:
```
http.request (130ms)
  ├─ db.select - users (50ms)
  └─ db.select - articles (80ms)
```

### Event Handling

Creating a user triggers:
1. HTTP request trace
2. Database insert span
3. `user/created` event sent to Inngest
4. Console log: "📧 Sending welcome email to: user@example.com"

### Cron Jobs

The daily cleanup cron (`0 0 * * *`) is registered and visible in Inngest Dev Server.

## Code Structure

```
src/
└── index.ts        # Main app with service definitions
```

Everything in one file to keep it simple!

## Key Concepts

### 1. Service Builder Pattern

```typescript
const userService = createService('users', inngest)
  .use(middleware)           // Service-level middleware
  .endpoint(...)             // HTTP endpoints
  .on('event', handler)      // Event handlers
  .cron('schedule', handler) // Cron jobs
```

### 2. Automatic Tracing

Vision middleware automatically:
- Creates traces for all requests
- Captures request/response metadata
- Broadcasts to dashboard

### 3. Custom Spans

```typescript
const withSpan = useVisionSpan()

const data = withSpan('db.select', {
  'db.table': 'users'
}, () => {
  // Your code - automatically tracked!
  return fetchUsers()
})
```

### 4. Type-safe Validation

```typescript
.endpoint(
  'POST',
  '/users',
  {
    input: z.object({
      name: z.string().min(1),
      email: z.string().email()
    }),
    output: z.object({
      id: z.string()
    })
  },
  async (data) => {
    // data is fully typed!
    return { id: '123' }
  }
)
```

## Troubleshooting

### Error: "Failed to start Inngest Dev Server"

**Cause:** Inngest CLI is not installed.

**Solution:**
```bash
# Install Inngest CLI
brew install inngest/tap/inngest

# Verify installation
inngest version
```

### Error: "fetch failed" when creating a user

**Cause:** Inngest Dev Server didn't start or is not responding.

**Solution:**
1. Check that Inngest CLI is installed: `inngest version`
2. Check the app logs for "Inngest Dev Server running"
3. Verify `inngest.yaml` has `dev: true` enabled
4. Check that `.env.development` has:
   ```
   INNGEST_DEV=1
   INNGEST_BASE_URL=http://localhost:8288
   ```

### Error: "Cannot find module 'dotenv'"

**Solution:**
```bash
bun install dotenv
```

### Events not appearing in Inngest UI

**Cause:** Inngest Dev Server UI is at a different URL.

**Solution:**
1. Open `http://localhost:8288` in your browser (not 8289)
2. You should see the Inngest Dev Server dashboard
3. Create a user with:
   ```bash
   curl -X POST http://localhost:3000/users \
     -H "Content-Type: application/json" \
     -d '{"name":"Test","email":"test@example.com"}'
   ```
4. Check the dashboard for the `user/created` event

### Manual Inngest Server Start

If you prefer to run Inngest manually instead of auto-start:

1. Disable auto-start in `src/index.ts`:
   ```typescript
   inngest: {
     autoStart: false,  // Disable auto-start
     port: 8288,
     configPath: './inngest.yaml'
   }
   ```

2. Start Inngest in a separate terminal:
   ```bash
   inngest dev --config inngest.yaml
   ```

## Next Steps

1. Add authentication middleware
2. Connect real database (Drizzle, Prisma)
3. Add more event handlers
4. Deploy to production

## Learn More

- [Vision Server Documentation](../../packages/server/README.md)
- [Vision Core](../../packages/core/README.md)
- [Hono Documentation](https://hono.dev)
- [Inngest Documentation](https://www.inngest.com/docs)
