# Hono + Vision + Drizzle Example

Complete example with Hono API, Vision Dashboard, and Drizzle ORM with SQLite.

## Quick Start

```bash
# Install dependencies
pnpm install

# Setup database
pnpm db:push

# Run in development mode (starts Vision + Drizzle Studio)
pnpm dev
```

## What's included

- ✅ **Vision Dashboard** - API monitoring with distributed tracing
- ✅ **Drizzle ORM** - Type-safe SQLite database
- ✅ **Drizzle Studio** - Auto-started database browser
- ✅ **DB Spans** - Database queries traced in waterfall
- ✅ **CRUD API** - Full user management endpoints
- ✅ **Service Catalog** - Auto-grouped endpoints

## Features

### Vision Dashboard (http://localhost:9500)
- **API Explorer** - Test endpoints with multi-tab sessions
- **Traces** - Waterfall visualization with DB spans
- **Logs** - Real-time structured logging
- **Services** - Auto-grouped endpoints (Root, Users)
- **Database** - Embedded Drizzle Studio (http://localhost:4983)

### Drizzle Studio (http://localhost:4983)
- Auto-started by Vision
- Browse/edit database records
- Visual schema explorer

## Try it out

1. **Start the server**: `pnpm dev`
2. **Open Vision Dashboard**: http://localhost:9500
3. **Test endpoints**:
   ```bash
   # Create user
   curl -X POST http://localhost:3000/users \
     -H "Content-Type: application/json" \
     -d '{"name":"Alice","email":"alice@example.com"}'
   
   # Get all users
   curl http://localhost:3000/users
   
   # Get user by ID
   curl http://localhost:3000/users/1
   
   # Update user
   curl -X PUT http://localhost:3000/users/1 \
     -H "Content-Type: application/json" \
     -d '{"name":"Alice Updated","email":"alice@example.com"}'
   
   # Delete user
   curl -X DELETE http://localhost:3000/users/1
   ```

4. **Watch in Vision Dashboard**:
   - See traces with DB spans in waterfall
   - Check structured logs
   - Navigate service catalog
   - Browse database in Drizzle Studio tab

## Database

Schema: `src/db/schema.ts`
```ts
users {
  id: integer (primary key)
  name: text
  email: text (unique)
  createdAt: timestamp
}
```

Commands:
```bash
pnpm db:generate  # Generate migrations
pnpm db:push      # Push schema to DB (no migrations)
pnpm db:studio    # Open Drizzle Studio manually
```

## Architecture

### Distributed Tracing with DB Spans

Each request creates a trace with nested spans:

```
POST /users (201, 45ms)
  └─ http.request (45ms)
      └─ db.insert (12ms)  ← Child span shows DB timing!
```

### Custom Spans with `useVisionSpan()`

```ts
import { useVisionSpan } from '@getvision/adapter-hono'

app.post('/users', async (c) => {
  const withSpan = useVisionSpan()  // ✨ Auto-context from AsyncLocalStorage
  
  // Wrap any operation in a span
  const user = withSpan('db.insert', { 'db.table': 'users' }, () => {
    return db.insert(users).values({...}).returning().get()
  })
  
  return c.json(user, 201)
})
```

**No manual propagation needed!** `useVisionSpan()` uses AsyncLocalStorage to automatically get the current trace context.

### What Vision Captures

- ✅ **Request metadata** - headers, query params, JSON body
- ✅ **Response metadata** - status, headers, JSON body
- ✅ **Nested spans** - database queries, external APIs, custom operations
- ✅ **Error traces** - stack traces, error messages
- ✅ **Timing data** - millisecond precision for each span
- ✅ **Attributes** - custom metadata on any span

### Example Trace Output

```json
{
  "id": "trace_xyz",
  "method": "POST",
  "path": "/users",
  "status": 201,
  "duration": 45,
  "spans": [
    {
      "id": "span_1",
      "name": "http.request",
      "duration": 45,
      "attributes": {
        "http.method": "POST",
        "http.path": "/users",
        "http.status_code": 201
      }
    },
    {
      "id": "span_2",
      "name": "db.insert",
      "duration": 12,
      "parentId": "span_1",
      "attributes": {
        "db.system": "sqlite",
        "db.table": "users"
      }
    }
  ]
}
```
