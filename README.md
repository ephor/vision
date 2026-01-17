# Vision 🔮

**Universal observability dashboard for API development**

Vision is a development dashboard that provides unified observability across protocols and validation libraries. Add it to your existing Express, Fastify, or Hono application.

> Protocol-agnostic monitoring with support for REST (GraphQL, tRPC, and MCP are in development)

<div align="center">
  <img src="https://github.com/user-attachments/assets/a0f46bbd-901f-48ed-966c-4f456a71b2d5" alt="Vision Dashboard - API observability and testing interface" width="800"/>
</div>

---

## Features

### Multi-Protocol Support
- REST APIs, GraphQL, tRPC, and Model Context Protocol (MCP)
- Unified tracing across all protocols
- Service catalog with auto-discovery

### Validation Library Integration
- **Zod** - Full feature support
- **Valibot** - Modern validation support  
- **Standard Schema v1** - Universal compatibility
- Automatic request template generation
- Real-time validation error display

### Development Tools
- API playground with multi-tab testing
- Live logs with trace context
- Performance monitoring
- TypeScript-first implementation

---

## Logging Philosophy

Vision implements the **Wide Events** logging approach - add context once, see it everywhere. This method provides:

- Structured logging with automatic context propagation
- Trace-aware log grouping
- Reduced noise while maintaining full observability

---

## Quick Start

### Add to Existing App (Express Example)

```typescript
import express from 'express'
import { visionAdapter } from '@getvision/adapter-express'
import { z } from 'zod' // or v from 'valibot'!

const app = express()

// Add Vision in development
if (process.env.NODE_ENV !== 'production') {
  app.use('*', visionAdapter({ port: 9500 }))
}

// Your existing endpoints - now with Vision!
app.post('/users', 
  // Automatic template generation!
  validator('body', z.object({
    name: z.string(),
    email: z.string().email(),
  })),
  (req, res) => {
    // req.body is fully typed and validated
    res.json(req.body)
  }
)

app.listen(3000)
// Dashboard at http://localhost:9500
```

### Start from Scratch (Hono-based)

```typescript
import { Vision } from '@getvision/server'
import { v } from 'valibot'

const app = new Vision({ service: { name: 'My API' } })

app.service('users').endpoint('POST', '/users', {
  input: v.object({
    name: v.string(),
    email: v.pipe(v.string(), v.email()),
  }),
  output: v.object({
    id: v.string(),
    name: v.string(),
  })
}, async (input) => {
  return { id: '1', ...input }
})

app.start(3000)
// Dashboard at http://localhost:9500
```

---

## Supported Frameworks

- **Express** - Stable
- **Fastify** - Stable  
- **Hono** - Stable
- tRPC - In development
- NestJS - Planned
- Next.js API Routes - Planned

---

## Documentation

Full documentation at **[getvision.dev/docs](https://getvision.dev/docs)**

- [Getting Started](https://getvision.dev/docs/quickstart)
- [Validation Libraries](https://getvision.dev/docs/validation)
- [Adapter Guides](https://getvision.dev/docs/adapters)
- [Deployment](https://getvision.dev/docs/deployment)

---
