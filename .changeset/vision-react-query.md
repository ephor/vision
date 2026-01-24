---
"@getvision/react-query": minor
"@getvision/core": minor
---

Add Vision React Query - tRPC-like client for REST APIs

### New Package: @getvision/react-query

A type-safe React Query client that brings tRPC-like DX to existing REST APIs without requiring backend changes.

**Features:**
- tRPC-compatible API (queryOptions, mutationOptions, prefetch)
- Auto-discovery from Vision Dashboard
- Compile-time type safety with defineTypedRoutes
- SSR support for Next.js App Router
- Works with Express, Fastify, Hono

**Usage:**
```typescript
// Server - NO CHANGES to existing REST API!
app.get('/users/list', validator('query', schema), handler)

// Client - tRPC-like API
const api = createVisionClient<typeof routes>({ baseUrl: 'http://localhost:3000' })
const { data } = useQuery(api.users.list.queryOptions({ page: 1, limit: 10 }))
```

### Vision Core Changes

- Added `routes/export-metadata` JSON-RPC method for route discovery
- Added `/api/routes-metadata` HTTP endpoint for client auto-discovery

### Example Application

New example at `examples/react-query-demo/` demonstrating:
- Hono server with Vision adapter
- Type-safe client with full CRUD operations
- React component examples
- SSR support
