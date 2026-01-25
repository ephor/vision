# Vision React Query Demo

This example demonstrates how to use **@getvision/react-query** to get tRPC-like DX with your existing REST API.

## What's Included

- **Server** (`server/index.ts`) - Hono API with Vision adapter
- **Client** (`client/api.ts`) - Type-safe API client using `defineTypedRoutes`
- **React Example** (`client/UserList.example.tsx`) - Usage examples with React Query

## Features Demonstrated

### 1. Server Setup (No Changes to Your API!)

```typescript
// server/index.ts
import { Hono } from 'hono'
import { visionAdapter, enableAutoDiscovery, validator } from '@getvision/adapter-hono'

const app = new Hono()

// Add Vision
app.use('*', visionAdapter({ port: 9500 }))

// Your normal REST endpoints
app.get('/users/list', validator('query', schema), handler)
app.post('/users/create', validator('json', schema), handler)

enableAutoDiscovery(app)
```

### 2. Shared Schemas (Single Source of Truth)

```typescript
// shared/routes.ts - Used by both server and client
export const routes = {
  users: {
    list: {
      method: 'GET' as const,
      path: '/users/list',
      input: z.object({ page: z.number(), limit: z.number() }),
      output: z.object({ users: z.array(userSchema), ... })
    },
    create: {
      method: 'POST' as const,
      path: '/users/create',
      input: createUserSchema,
      output: userSchema
    }
  }
} as const
```

### 3. Server Uses Shared Schemas

```typescript
// server/index.ts
import { routes } from '../shared/routes'

// Use schemas from routes contract
app.get('/users/list', validator('query', routes.users.list.input), handler)
app.post('/users/create', validator('json', routes.users.create.input), handler)
```

### 4. Client Uses Shared Schemas

```typescript
// client/api.ts
import { createVisionClient } from '@getvision/react-query'
import { routes } from '../shared/routes'

// ✅ Runtime + Types - no duplication!
export const api = createVisionClient(routes, {
  baseUrl: 'http://localhost:3000'
})
```

### 3. React Usage (EXACTLY like tRPC!)

```typescript
// Query
const { data } = useQuery(
  api.users.list.queryOptions({ page: 1, limit: 10 })
)

// Mutation
const mutation = useMutation(
  api.users.create.mutationOptions({
    onSuccess: () => queryClient.invalidateQueries()
  })
)

mutation.mutate({ name: 'John', email: 'john@example.com' })
```

## Running the Example

### 1. Install dependencies

```bash
bun install
```

### 2. Start the server

```bash
bun run server
```

This starts:
- API server on `http://localhost:3000`
- Vision Dashboard on `http://localhost:9500`

### 3. Open the Dashboard

Visit `http://localhost:9500` to see:
- All discovered routes
- Real-time request tracing
- Request/response payloads
- Performance metrics
- API playground

### 4. Try the API

The server exposes these endpoints:

```bash
# List users
curl http://localhost:3000/users/list?page=1&limit=10

# Create user
curl -X POST http://localhost:3000/users/create \
  -H "Content-Type: application/json" \
  -d '{"name":"Bob","email":"bob@example.com"}'

# Update user
curl -X PUT http://localhost:3000/users/1/update \
  -H "Content-Type: application/json" \
  -d '{"name":"Bob Updated"}'

# Delete user
curl -X DELETE http://localhost:3000/users/1/delete
```

## Client Usage

The client code is in `client/` for demonstration. In a real app:

1. **Copy `client/api.ts`** to your React app
2. **Install dependencies**:
   ```bash
   npm install @getvision/react-query @tanstack/react-query
   ```
3. **Use the hooks** in your components (see `UserList.example.tsx`)

## Type Safety

Vision React Query provides **full compile-time type safety**:

```typescript
// ✅ Correct
const { data } = useQuery(
  api.users.list.queryOptions({ page: 1, limit: 10 })
)
// data is typed as { users: User[], page: number, limit: number, total: number }

// ❌ Type error!
const { data } = useQuery(
  api.users.list.queryOptions({ page: 'invalid' })
)
// Error: Type 'string' is not assignable to type 'number'
```

## SSR Support

For Next.js App Router:

```typescript
// app/users/page.tsx (Server Component)
import { createVisionServerClient, getDehydratedState } from '@getvision/react-query/server'
import { HydrationBoundary } from '@tanstack/react-query'

export default async function UsersPage() {
  const serverApi = createVisionServerClient<typeof routes>({
    baseUrl: 'http://localhost:3000',
    headers: { cookie: cookies().toString() }
  })

  // Prefetch on server
  await serverApi.users.list.prefetch({ page: 1, limit: 10 })

  return (
    <HydrationBoundary state={getDehydratedState(serverApi)}>
      <UserList />  {/* Client Component */}
    </HydrationBoundary>
  )
}
```

## Why Vision React Query?

| Feature | tRPC | Vision React Query |
|---------|------|-------------------|
| tRPC-like API | ✅ | ✅ |
| Type safety | ✅ | ✅ |
| **Works with existing REST APIs** | ❌ | ✅ 🔥 |
| **No code changes** | ❌ | ✅ 🔥 |
| **Normal HTTP endpoints** | ❌ | ✅ 🔥 |
| **Dashboard included** | ❌ | ✅ 🔥 |
| **Works with Express/Fastify/Hono** | ❌ | ✅ 🔥 |

## Learn More

- [Vision Documentation](https://getvision.dev/docs)
- [@getvision/react-query README](../../packages/react-query/README.md)
- [React Query Documentation](https://tanstack.com/query/latest)
