# Fastify Basic Example

Example Fastify application using Vision Dashboard.

## Features

- ✅ **Vision Plugin** - Automatic request tracing via Fastify hooks
- ✅ **Custom Spans** - Track database queries and operations
- ✅ **Auto-discovery** - Routes automatically registered in Vision (services grouping)
- ✅ **Zod validation** - Native Fastify schema support with Zod
- ✅ **CORS ready** - headers for Vision Dashboard added automatically
- ✅ **Error Tracking** - Errors captured in spans

## Quick Start

```bash
# Install dependencies
bun install

# Run development server
bun dev
```

## URLs

- **Fastify API**: http://localhost:3000
- **Vision Dashboard**: http://localhost:9500

## API Endpoints

### GET /
Get API info

```bash
curl http://localhost:3000/
```

### GET /users
List all users (with DB span)

```bash
curl http://localhost:3000/users
```

### GET /users/:id
Get user by ID (with multiple DB spans)

```bash
curl http://localhost:3000/users/1
```

### POST /users
Create new user (with Zod validation and DB span)

```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","age":25}'
```

### PUT /users/:id
Update user (with Zod validation and DB span)

```bash
curl -X PUT http://localhost:3000/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice Updated"}'
```

### DELETE /users/:id
Delete user (with DB span)

```bash
curl -X DELETE http://localhost:3000/users/1
```

## Vision Features

### Request Tracing
Every request is automatically traced with:
- HTTP method, path, query params
- Request/response headers
- Status code and duration
- Custom spans

### Custom Spans
Track database operations:

```typescript
const withSpan = useVisionSpan()

const users = withSpan('db.select', { 
  'db.system': 'postgresql',
  'db.table': 'users' 
}, () => {
  return db.select().from(users).all()
})
```

### Auto-Discovery
Routes are automatically discovered and shown in Vision dashboard:

```typescript
enableAutoDiscovery(app)

// Optional manual services grouping
// enableAutoDiscovery(app, { services: [
//   { name: 'Users', routes: ['/users/*'] }
// ]})
```

### Zod Validation
Fastify's native schema support with Zod:

```typescript
const CreateUserSchema = z.object({
  name: z.string().min(1).describe('Full name'),
  email: z.string().email().describe('Email'),
})

app.post('/users', {
  schema: {
    body: CreateUserSchema
  }
}, async (request, reply) => {
  return request.body
})
```

## Testing Vision

1. Start the app: `bun dev`
2. Open Vision Dashboard: http://localhost:9500
3. Make requests to the API
4. See traces in the dashboard! Root span `http.request` will include child spans like `db.select`.

## Learn More

- [Vision Documentation](../../apps/docs)
- [Fastify Adapter Documentation](../../packages/adapter-fastify)
