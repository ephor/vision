# Vision React Query - Type Safety Approaches

There are **3 ways** to get type-safe API client with Vision React Query. Choose based on your project structure.

## 📊 Comparison

| Approach | Monorepo | Separate Repos | Type Safety | Runtime Schemas | Duplication |
|----------|----------|----------------|-------------|-----------------|-------------|
| **Shared Schemas** | ✅ **Best** | ❌ | ✅ Compile + Runtime | ✅ | ❌ None |
| **Auto-Discovery** | ✅ Good | ⚠️ Limited | ⚠️ Runtime only | ✅ | ❌ None |
| **Code Generation** | ✅ Good | ✅ **Best** | ✅ Compile + Runtime | ✅ | ❌ Auto-generated |

---

## 1. ✅ Shared Schemas (Recommended for Monorepo)

**Best for:** Monorepo, full-stack TypeScript projects

### Setup

```
project/
  shared/
    routes.ts          # Single source of truth
  server/
    index.ts           # Uses shared schemas
  client/
    api.ts             # Uses shared schemas
```

### Code

```typescript
// shared/routes.ts - SINGLE SOURCE OF TRUTH
import { z } from 'zod'

export const routes = {
  users: {
    list: {
      method: 'GET' as const,
      path: '/users/list',
      input: z.object({ page: z.number(), limit: z.number() }),
      output: z.object({
        users: z.array(userSchema),
        total: z.number()
      })
    },
    create: {
      method: 'POST' as const,
      path: '/users/create',
      input: createUserSchema,
      output: userSchema
    }
  }
} as const

export type User = z.infer<typeof userSchema>
```

```typescript
// server/index.ts - Use shared schemas
import { routes } from '../shared/routes'

app.get('/users/list', validator('query', routes.users.list.input), (c) => {
  // Input is validated & typed automatically
  const { page, limit } = c.req.valid('query')
  return c.json({ users: [], total: 0 })
})
```

```typescript
// client/api.ts - Use shared schemas
import { createVisionClient } from '@getvision/react-query'
import { routes } from '../shared/routes'

export const api = createVisionClient(routes, {
  baseUrl: 'http://localhost:3000'
})

// ✅ Fully typed - compile-time + runtime!
const { data } = useQuery(api.users.list.queryOptions({ page: 1, limit: 10 }))
//    ^-- data: { users: User[], total: number }
```

### Pros & Cons

✅ **Pros:**
- Zero duplication - schemas defined once
- Compile-time + runtime type safety
- No codegen needed
- Changes propagate automatically
- Can use Zod/Valibot features (transforms, defaults, etc.)

❌ **Cons:**
- Requires monorepo or shared package
- Server and client must share code

---

## 2. ⚠️ Auto-Discovery (Limited - Runtime Only)

**Best for:** Quick prototyping, development

### Code

```typescript
// client/api.ts
import { createVisionClient } from '@getvision/react-query'

// Type-only import - doesn't work for runtime!
// import type { AppRouter } from '../server'

export const api = createVisionClient({
  baseUrl: 'http://localhost:3000',
  dashboardUrl: 'http://localhost:9500'  // Vision Dashboard must be running
})

// ⚠️ Runtime works, but NO compile-time types
const { data } = useQuery(api.users.list.queryOptions({ page: 1, limit: 10 }))
//    ^-- data: any (no type safety!)
```

### Pros & Cons

✅ **Pros:**
- No setup required
- Works with any framework
- Discovers routes automatically from Vision Dashboard

❌ **Cons:**
- **No compile-time type safety** - only runtime
- Requires Vision Dashboard running
- Can't import types from server (type-only imports don't include runtime)

### Why This Doesn't Work?

```typescript
// ❌ DOESN'T WORK
import type { AppRouter } from '../server'  // Type-only import

const api = createVisionClient<AppRouter>({ ... })
// AppRouter only exists at compile-time, NOT at runtime!
// Vision can't access Zod schemas from type-only import
```

**The problem:** TypeScript `import type` is erased at runtime. Vision needs actual Zod schemas to:
1. Generate query keys
2. Validate inputs/outputs
3. Provide runtime type safety

---

## 3. 🔧 Code Generation (Future)

**Best for:** Separate repos, microservices

### How It Works

```bash
# On server - expose OpenAPI/metadata
vision export --output ./api-spec.json

# On client - generate types
vision generate --input ./api-spec.json --output ./src/api/generated.ts
```

### Generated Code

```typescript
// src/api/generated.ts (auto-generated)
export const routes = {
  users: {
    list: {
      method: 'GET',
      path: '/users/list',
      input: z.object({ page: z.number() }),
      output: z.object({ users: z.array(...) })
    }
  }
}

export type User = { id: number; name: string }
```

```typescript
// src/api/client.ts
import { createVisionClient } from '@getvision/react-query'
import { routes } from './generated'

export const api = createVisionClient(routes, {
  baseUrl: process.env.API_URL
})

// ✅ Fully typed from generated code
```

### Pros & Cons

✅ **Pros:**
- Works with separate repos
- Compile-time + runtime type safety
- Can version API contracts
- Works with any backend language (not just TypeScript)

❌ **Cons:**
- Requires build step / codegen
- Need to regenerate on API changes
- More complex setup

### Similar Tools

- [Encore client generation](https://encore.dev/docs/ts/cli/client-generation)
- [OpenAPI generators](https://openapi-generator.tech/)
- [Orval](https://orval.dev/)

---

## 📝 Recommendations

### Use **Shared Schemas** if:
- ✅ Monorepo (Nx, Turborepo, pnpm workspace)
- ✅ Full-stack TypeScript
- ✅ You want zero duplication
- ✅ Server & client can share code

### Use **Code Generation** if:
- ✅ Separate repos (frontend/backend)
- ✅ Microservices architecture
- ✅ Multiple clients (web, mobile, etc.)
- ✅ Non-TypeScript backend
- ✅ You need versioned API contracts

### Use **Auto-Discovery** if:
- ✅ Quick prototyping
- ✅ Development only
- ⚠️ You're okay with runtime-only types

---

## 🚀 Migration Path

### From Manual Types → Shared Schemas

```diff
  // Before - duplicate types everywhere
- const createUser = async (input: { name: string; email: string }) => {
-   return fetch('/users/create', { body: JSON.stringify(input) })
- }

  // After - use shared schemas
+ import { routes } from '../shared/routes'
+ const { data } = useMutation(api.users.create.mutationOptions())
```

### From tRPC → Vision

```diff
  // Before
- import { trpc } from './trpc-client'
- const { data } = useQuery(trpc.users.list.queryOptions({ limit: 10 }))

  // After - IDENTICAL API!
+ import { api } from './vision-client'
+ const { data } = useQuery(api.users.list.queryOptions({ limit: 10 }))
```

---

## 💡 Future: Hybrid Approach

Combine best of both worlds:

```typescript
// Development - use shared schemas for fast iteration
const api = createVisionClient(routes, { baseUrl: 'http://localhost:3000' })

// Production - use generated types from versioned contract
const api = createVisionClient(generatedRoutes, { baseUrl: process.env.API_URL })
```

---

## ❓ FAQ

### Q: Can I use Vision without TypeScript?

**A:** Yes, but you lose compile-time type safety. Runtime validation still works.

### Q: Can I mix shared schemas + auto-discovery?

**A:** Yes! Use shared schemas for core API, auto-discovery for experimental endpoints.

### Q: Does this work with GraphQL/tRPC?

**A:** GraphQL - not yet. tRPC - you don't need Vision, use tRPC's client directly.

### Q: What about Zod transforms/refinements?

**A:** ✅ Works perfectly with shared schemas! Server and client use same Zod schema.

```typescript
const routes = {
  users: {
    create: {
      input: z.object({
        email: z.string().email().transform(s => s.toLowerCase()),
        age: z.number().refine(n => n >= 18, 'Must be 18+')
      })
    }
  }
}
```

---

**TL;DR:** Use **shared schemas** for monorepo, **code generation** for separate repos. Auto-discovery is limited to runtime-only types.
