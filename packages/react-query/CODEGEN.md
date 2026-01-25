# Vision React Query - Auto-Codegen (Experimental)

**🚀 Auto-generate type-safe client from your API routes!**

NO manual schemas. NO duplication. Just start your server and get a fully typed client! ✨

## The Problem

**Current approaches suck:**

❌ **Manual schemas** - Duplicating everything by hand:
```typescript
// Ugh, duplicating all schemas manually 😭
const routes = defineTypedRoutes({
  users: { list: { input: z.object(...), output: z.object(...) } }
})
```

❌ **External codegen tools** - Extra build steps:
```bash
# Generate OpenAPI spec
npm run generate:openapi
# Run codegen tool
npm run generate:client
# Add to CI/CD, remember to run before build...
```

## ✨ The Solution: Built-in Auto-Codegen

```typescript
// server/index.ts
app.use('*', visionAdapter({
  port: 9500,
  // 🔥 JUST ADD THIS!
  client: {
    output: './client/generated.ts',
    watch: true  // Auto-regenerate on changes
  }
}))

// Your routes - NO CHANGES!
app.get('/users/list', validator('query', schema), handler)
app.post('/users/create', validator('json', schema), handler)

enableAutoDiscovery(app)
```

**That's it!** When server starts, Vision automatically:
1. Discovers all routes
2. Extracts schemas from validators
3. Generates `client/generated.ts` with full types
4. Re-generates on route changes (dev mode)

## Generated Client

```typescript
// client/generated.ts - AUTO-GENERATED! ✨
import { createVisionClient } from '@getvision/react-query'
import { z } from 'zod'

// Auto-generated schemas
const users_list_input = z.object({
  page: z.number(),
  limit: z.number()
})

const users_list_output = z.object({
  users: z.array(userSchema),
  total: z.number()
})

// Auto-generated routes
const routes = {
  users: {
    list: {
      method: 'GET',
      path: '/users/list',
      input: users_list_input,
      output: users_list_output
    }
  }
}

// Ready to use!
export const api = createVisionClient(routes, {
  baseUrl: 'http://localhost:3000'
})

// Type exports
export type User = z.infer<typeof users_list_output.shape.users.element>
```

## Usage - Just Import!

```typescript
// components/UserList.tsx
import { api } from './client/generated'  // ✨ Auto-generated!

const { data } = useQuery(
  api.users.list.queryOptions({ page: 1, limit: 10 })
)
// data is FULLY TYPED! No manual work! 🔥
```

## Configuration

```typescript
app.use('*', visionAdapter({
  client: {
    // Required: where to generate the client
    output: './src/api/generated.ts',

    // Optional: base URL (can be set at runtime)
    baseUrl: 'http://localhost:3000',

    // Optional: watch mode (default: true in dev, false in prod)
    watch: process.env.NODE_ENV === 'development',

    // Optional: include Zod validation (default: true)
    includeValidation: true,

    // Optional: framework (default: 'react-query')
    framework: 'react-query'  // or 'vanilla'
  }
}))
```

## How It Works

### 1. Route Discovery

Vision already discovers routes through adapters:

```typescript
// Vision automatically knows about:
{
  method: 'GET',
  path: '/users/list',
  handler: 'listUsers',
  requestBody: {  // From validator('query', schema)
    template: '{ page: 1, limit: 10 }',
    fields: [
      { name: 'page', type: 'number', required: true },
      { name: 'limit', type: 'number', required: true }
    ]
  }
}
```

### 2. Schema Extraction

Vision extracts Zod/Valibot schemas from validators:

```typescript
app.get('/users', validator('query', paginationSchema), handler)
//                                    ^^^^^^^^^^^^^^^^
//                                    Vision extracts this!
```

### 3. Code Generation

Vision generates TypeScript code:

```typescript
// For each route:
const ${service}_${procedure}_input = ${extractedSchema}
const ${service}_${procedure}_output = ${inferredFromHandler}

// Routes object:
const routes = {
  ${service}: {
    ${procedure}: {
      method: '${method}',
      path: '${path}',
      input: ${service}_${procedure}_input,
      output: ${service}_${procedure}_output
    }
  }
}

// Client:
export const api = createVisionClient(routes, { baseUrl })
```

### 4. Watch Mode (Development)

In dev mode, Vision watches for route changes:

```typescript
// When you add/modify a route:
app.post('/users/:id/update', validator('json', updateSchema), handler)
//                                                ^^^^^^^^^^^^
// Vision detects change and regenerates client! ✨
```

## Comparison

| Approach | Setup | Duplication | Type Safety | Auto-Updates |
|----------|-------|-------------|-------------|--------------|
| **Auto-Codegen** | ✅ 1 line | ❌ None | ✅ Full | ✅ Yes |
| Manual Schemas | ⚠️ Per route | ❌ High | ✅ Full | ❌ Manual |
| External Codegen | ⚠️ Complex | ❌ None | ✅ Full | ⚠️ CI/CD |
| Auto-Discovery | ✅ None | ❌ None | ⚠️ Runtime only | ✅ Yes |

## Examples

### Monorepo

```
project/
  apps/
    api/
      src/
        index.ts          # Server with visionAdapter
    web/
      src/
        api/
          generated.ts    # Auto-generated client ✨
        components/
          UserList.tsx    # Uses api from generated.ts
```

```typescript
// apps/api/src/index.ts
visionAdapter({
  client: {
    output: '../../web/src/api/generated.ts'  // Cross-app!
  }
})
```

### Separate Repos

```bash
# API repo
npm run dev  # Starts server, generates client

# Frontend repo
# Copy generated.ts from API repo (or use API as dependency)
cp ../api/client/generated.ts ./src/api/
```

### CI/CD

```yaml
# .github/workflows/deploy.yml
- name: Generate API client
  run: |
    npm run build  # Vision generates client during build
    cp packages/api/client/generated.ts packages/web/src/api/
```

## Future Enhancements

### Output Multiple Formats

```typescript
client: {
  outputs: {
    reactQuery: './web/src/api/generated.ts',
    vanilla: './mobile/src/api/generated.ts',
    openapi: './docs/openapi.json'
  }
}
```

### Remote Generation

```bash
# Generate client from running server
vision generate --url http://localhost:9500 --output ./src/api/client.ts
```

### Plugin Ecosystem

```typescript
// vite.config.ts
import { visionClient } from '@getvision/vite-plugin'

export default {
  plugins: [
    visionClient({
      url: 'http://localhost:9500',
      output: './src/api/generated.ts'
    })
  ]
}
```

## FAQ

### Q: Do I need to restart the server for changes?

**A:** In dev mode with `watch: true`, NO! Vision auto-regenerates on route changes.

### Q: What if my routes don't have validators?

**A:** Vision will generate basic types from route metadata. Add validators for better type safety!

### Q: Can I customize the generated code?

**A:** Not directly (it's auto-generated!). But you can wrap it:

```typescript
// src/api/client.ts
import { api as generated } from './generated'

export const api = {
  ...generated,
  // Add custom methods
  users: {
    ...generated.users,
    customMethod: () => { /* custom logic */ }
  }
}
```

### Q: Does this work with Express/Fastify?

**A:** YES! All adapters support auto-codegen.

### Q: What about response types?

**A:** Currently inferred from request handlers. Future: explicit response schemas.

---

## TL;DR

```typescript
// Before: Manual schemas 😭
const routes = defineTypedRoutes({ /* 100 lines of duplication */ })

// After: Auto-codegen 🔥
app.use('*', visionAdapter({ client: { output: './generated.ts' } }))
```

**NO duplication. FULL type safety. AUTOMATIC updates.**

This is the future! 🚀
