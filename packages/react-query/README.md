# @getvision/react-query

Type-safe React Query client for Vision - **tRPC-like DX for REST APIs**

## Features

- ✅ **Auto-discovery** - Automatically discovers routes from your API
- ✅ **Type-safe** - Full TypeScript support with type inference
- ✅ **React Query integration** - Works seamlessly with `@tanstack/react-query`
- ✅ **tRPC-like API** - `queryOptions`, `mutationOptions`, `prefetch`
- ✅ **Zero config** - Just point to your Vision Dashboard
- ✅ **SSR support** - Works with Next.js App Router, Remix, etc.
- ✅ **Framework agnostic** - Works with Express, Fastify, Hono

## Installation

```bash
bun add @getvision/react-query @tanstack/react-query
```

## Quick Start

### 1. Server Setup (Hono example)

```typescript
// server/index.ts
import { Hono } from 'hono'
import { visionAdapter, enableAutoDiscovery, validator } from '@getvision/adapter-hono'
import { z } from 'zod'

const app = new Hono()

// Add Vision adapter
app.use('*', visionAdapter({ port: 9500 }))

// Define your routes
app.get('/chats/paginated',
  validator('query', z.object({ pageId: z.string(), limit: z.number() })),
  async (c) => {
    const { pageId, limit } = c.req.valid('query')
    return c.json(await db.query.chats.findMany({ where: eq(chats.pageId, pageId), limit }))
  }
)

app.post('/pages/create',
  validator('json', z.object({ title: z.string(), content: z.string() })),
  async (c) => {
    const input = c.req.valid('json')
    return c.json(await db.insert(pages).values(input).returning())
  }
)

// Enable auto-discovery
enableAutoDiscovery(app)

// Export type for client
export type AppRouter = typeof app
```

### 2. Client Setup

```typescript
// client/api.ts
import { createVisionClient } from '@getvision/react-query'
import type { AppRouter } from '../server' // Type-only import!

export const api = createVisionClient<AppRouter>({
  baseUrl: 'http://localhost:3000',        // Your API
  dashboardUrl: 'http://localhost:9500'    // Vision Dashboard
})
```

### 3. React Usage (EXACTLY like tRPC!)

```typescript
// components/Chat.tsx
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from './api'

export function Chat({ pageId }: { pageId: string }) {
  // Query - EXACTLY like tRPC! 🔥
  const { data: messagesData, isLoading: isLoadingMessages } = useQuery(
    api.chats.paginated.queryOptions(
      { pageId, limit: 50 },
      {
        initialData: initialMessages ?? emptyInitialChatData,
        enabled: Boolean(initialMessages),
        refetchOnMount: "always",
      }
    )
  )

  // Mutation - EXACTLY like tRPC! 🔥
  const createPageMutation = useMutation(
    api.pages.create.mutationOptions({
      onSuccess: () => {
        window.history.replaceState({}, "", `/page/${pageId}`)
      },
    })
  )

  return (
    <div>
      {isLoadingMessages ? <div>Loading...</div> : null}
      {messagesData?.messages.map(msg => <div key={msg.id}>{msg.content}</div>)}

      <button onClick={() => createPageMutation.mutate({ title: 'New Page', content: '' })}>
        Create Page
      </button>
    </div>
  )
}
```

## How It Works

Vision auto-discovers your routes and maps them to a type-safe client:

```
REST Route                   → Client API
──────────────────────────────────────────────────
GET /chats/paginated         → api.chats.paginated (query)
POST /pages/create           → api.pages.create (mutation)
GET /dashboard/users/list    → api.dashboard.users.list (query)
PUT /users/:id/update        → api.users.update (mutation)
```

- `GET` requests → **queries** (cacheable, refetchable)
- `POST/PUT/PATCH/DELETE` → **mutations** (invalidate cache)

## SSR Support (Next.js App Router)

```typescript
// app/page.tsx (Server Component)
import { createVisionServerClient, getDehydratedState } from '@getvision/react-query/server'
import { HydrationBoundary } from '@tanstack/react-query'
import { headers, cookies } from 'next/headers'

export default async function Page({ params }: { params: { pageId: string } }) {
  const api = createVisionServerClient<AppRouter>({
    baseUrl: 'http://localhost:3000',
    headers: {
      cookie: cookies().toString(),
      authorization: headers().get('authorization') || ''
    }
  })

  // Prefetch on server
  await api.chats.paginated.prefetch({
    pageId: params.pageId,
    limit: 50
  })

  return (
    <HydrationBoundary state={getDehydratedState(api)}>
      <ChatComponent pageId={params.pageId} />
    </HydrationBoundary>
  )
}
```

## API Reference

### `createVisionClient<TRouter>(config)`

Create a Vision React Query client.

**Config:**
- `baseUrl` - Your API base URL
- `dashboardUrl` - Vision Dashboard URL (default: `http://localhost:9500`)
- `queryClient` - Custom QueryClient instance (optional)
- `headers` - Headers to include in all requests (can be async function)

**Returns:** Type-safe client with auto-discovered routes

### Query Procedures

```typescript
// Call directly (outside React)
const users = await api.users.list({ limit: 10 })

// React Query options
const { data } = useQuery(
  api.users.list.queryOptions({ limit: 10 }, { staleTime: 60000 })
)

// Prefetch (SSR)
await api.users.list.prefetch({ limit: 10 })
```

### Mutation Procedures

```typescript
// Call directly
const user = await api.users.create({ name: 'John', email: 'john@example.com' })

// React Query mutation
const mutation = useMutation(
  api.users.create.mutationOptions({
    onSuccess: (data) => console.log('Created:', data)
  })
)

mutation.mutate({ name: 'John', email: 'john@example.com' })
```

## Authentication

```typescript
// Static headers
const api = createVisionClient<AppRouter>({
  baseUrl: 'http://localhost:3000',
  headers: {
    authorization: 'Bearer YOUR_TOKEN'
  }
})

// Dynamic headers (async function)
const api = createVisionClient<AppRouter>({
  baseUrl: 'http://localhost:3000',
  headers: async () => ({
    authorization: `Bearer ${await getToken()}`
  })
})
```

## Why Vision React Query?

| Feature | tRPC | Vision React Query |
|---------|------|-------------------|
| Type safety | ✅ | ✅ |
| React Query integration | ✅ | ✅ |
| tRPC-like API | ✅ | ✅ |
| **Works with existing REST APIs** | ❌ | ✅ 🔥 |
| **Normal HTTP endpoints** | ❌ | ✅ 🔥 |
| **Dashboard included** | ❌ | ✅ 🔥 |
| **Works with Express/Fastify/Hono** | ❌ | ✅ 🔥 |
| **No code changes required** | ❌ | ✅ 🔥 |

## License

MIT
