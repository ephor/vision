# Vision 🔮

**Universal Observability for Modern Apps - One tool for all protocols**

Vision is a universal development dashboard that supports **any protocol** your app uses: REST APIs, tRPC, MCP (Model
Context Protocol), GraphQL, and more. Protocol-agnostic and fully open source.

> 🎯 **One Dashboard. All Protocols.**
> Why juggle Postman, Thunder Client, MCPJam, and other tools when Vision handles everything?

## Why Vision?

While tools like Swagger UI focus on API documentation, Vision provides a **complete development experience**:

- 🌐 **Universal protocol support** - REST, tRPC, MCP, GraphQL in one tool
- 🔍 **Cross-protocol tracing** - see HTTP → tRPC → MCP calls in unified waterfall view
- 🧪 **Multi-protocol testing** - one playground to test REST endpoints, RPC methods, MCP tools
- 📊 **Live monitoring** - real-time logs, traces, updates across all protocols
- 🏗️ **Universal service catalog** - auto-discover endpoints, RPC procedures, MCP tools
- 🛠️ **Deep inspection** - headers, payloads, timing metrics for any protocol
- 🎯 **Framework agnostic** - works with any runtime (Node.js, Bun, Deno, Cloudflare Workers)

**100% Open Source. One tool for all protocols. No vendor lock.**

---

## 🎯 Why Vision vs Other Tools?

| Feature                | Vision         | Postman/Thunder | MCPJam     | Datadog       |
|------------------------|----------------|-----------------|------------|---------------|
| **REST APIs**          | ✅ Full support | ✅ Full support  | ❌          | ✅ Enterprise  |
| **tRPC**               | 🔜 Planned     | ❌               | ❌          | ❌             |
| **MCP**                | 🔜 Planned     | ❌               | ✅ MCP only | ❌             |
| **GraphQL**            | 🔜 Planned     | ⚠️ Limited      | ❌          | ✅ Enterprise  |
| **Real-time tracing**  | ✅ Built-in     | ❌               | ✅ MCP only | ✅ $$$         |
| **Testing playground** | ✅ Multi-tab    | ✅               | ✅ MCP only | ❌             |
| **Open source**        | ✅ MIT          | ❌ Proprietary   | ✅ Open     | ❌             |
| **Self-hosted**        | ✅ Free forever | ❌ Cloud only    | ✅          | ⚠️ Enterprise |
| **Price**              | Free           | Free/Paid       | Free       | $$$$          |

**Vision = Universal tool. Others = Protocol-specific or enterprise-only.**

---

## ✨ Features

### 🔍 Distributed Tracing

- **Waterfall visualization** - span timeline with parent-child relationships (root `http.request` + child DB spans)
- **Request/response capture** - full metadata including headers, body, query params
- **Trace correlation** - link logs to traces with `traceId`
- **Client metrics** - track network overhead vs server time
- **Export traces** - JSON/NDJSON format for external analysis

### 🚀 API Explorer

- **Multi-tab sessions** - test multiple endpoints simultaneously
- **Isolated traces** - each tab tracks its own requests
- **Auto-filled from catalog** - click endpoint in Service Catalog → opens in explorer
- **Response timing** - server time, client time, network overhead
- **cURL export** - copy as cURL command
 - **Commented templates** - API request body templates generated from Zod (comments auto-cleaned before sending)

### 📊 Logs

- **Live streaming** - real-time log updates via WebSocket
- **Structured logging** - request logs with method, endpoint, params, query, duration
- **Level filtering** - log/info/warn/error/debug filters
- **Search** - full-text search across log messages
- **Stack traces** - collapsible, selectable stack traces for errors
- **Go to trace** - jump from request log to its trace details

### 🏗️ Service Catalog

- **Encore-style sidebar** - tree view with Services → Endpoints
- **Auto-grouping** - routes grouped by path prefix (e.g., `/users/*` → Users service)
- **Manual configuration** - override grouping with custom service definitions
- **Integration detection** - auto-detect database, Redis from environment
- **Service metadata** - name, version, description, integrations

### 🎨 UI/UX

- **Dark/Light theme** - toggle with persistence
- **Tab persistence** - API Explorer tabs saved to localStorage
- **Highlight active trace** - selected trace highlighted in list
- **Auto-scroll** - traces list auto-scrolls to active item
- **Toast notifications** - success/error feedback for actions

**100% Open Source. No vendor lock. No proprietary cloud required.**

## 📚 Documentation

Full documentation available at **[docs.getvision.dev](https://vision-docs.pages.dev)** (coming soon)

---

## 🚀 Quick Start

Try it now:

```bash
# Install dependencies
bun install

# Run the Hono example
bun run example:hono
```

Then open `http://localhost:9500` in your browser! 🎉

This starts:

- 🚀 Hono API server on `http://localhost:3000`
- 🔮 Vision Dashboard (HTTP + WebSocket) on `http://localhost:9500`

**Everything on one port!** The Dashboard UI and WebSocket API are served together.

### Vision Server (Recommended)

```bash
npm i @getvision/server
```

```ts
import { Vision } from '@getvision/server'
import { z } from 'zod'

const app = new Vision({ service: { name: 'Vision' } })

app.service('users')
  .endpoint('GET', '/users/:id', {
    input: z.object({ id: z.string() }),
    output: z.object({ id: z.string(), name: z.string() })
  }, async ({ id }) => ({ id, name: 'John' }))

app.start(3000)
```

#### File-based Routes

Vision Server auto-loads sub-apps from `app/routes/**/index.ts`. Export a `Vision` instance from each folder; the folder path becomes the base route. Use `'/'` inside `.endpoint()` to target the folder index.

```
app/
  routes/
    analytics/
      dashboard/index.ts   -> GET /analytics/dashboard
      track/index.ts       -> POST /analytics/track
    products/
      index.ts             -> GET /products
      [id]/index.ts        -> GET /products/:id
```

Example (`app/routes/products/index.ts`):

```ts
import { Vision } from '@getvision/server'
import { z } from 'zod'

const app = new Vision()
app.service('products')
  .endpoint('GET', '/', {
    input: z.object({}),
    output: z.object({ items: z.array(z.object({ id: z.string() })) })
  }, async () => ({ items: [{ id: 'p1' }] }))
export default app
```

### Usage Example (Express)

```typescript
import express from 'express'
import { visionMiddleware, enableAutoDiscovery, zValidator } from '@getvision/adapter-express'
import { z } from 'zod'

const app = express()
app.use(express.json())

if (process.env.NODE_ENV !== 'production') {
  app.use(visionMiddleware({ port: 9500 }))
}

const CreateUser = z.object({
  name: z.string().min(1).describe('Full name'),
  email: z.string().email().describe('Email'),
})

app.post('/users', zValidator('body', CreateUser), (req, res) => res.status(201).json(req.body))

if (process.env.NODE_ENV !== 'production') {
  enableAutoDiscovery(app)
}

app.listen(3000)
```

### Usage Example (Hono)

```typescript
import {Hono} from 'hono'
import {visionAdapter, enableAutoDiscovery} from '@getvision/adapter-hono'

const app = new Hono()

// Add Vision in development
if (process.env.NODE_ENV !== 'production') {
  app.use('*', visionAdapter({port: 9500}))
  enableAutoDiscovery(app) // Auto-discover routes ✨
}

// Routes are automatically registered!
app.get('/hello', (c) => c.json({hello: 'world'}))

export default app
```

### What You'll See

- **API Explorer** - List of all endpoints with method badges
- **Request Builder** - Click "CALL API" to test endpoints
- **Response Viewer** - JSON response with status code and timing
- **Request Logs** - See request lifecycle logs
- **Real-time Updates** - Traces appear as you make requests

---

## 📎 Supported Protocols & Frameworks

### ✅ Currently Supported

- **Hono** - Full support with Zod integration
- **Express** - Middleware, auto-discovery, Zod validation, service catalog
- **Fastify** - Plugin-based, hooks lifecycle, native schema support

### 🔜 Planned Adapters

**High Priority (Community Demand):**

- **tRPC** - Type-safe RPC framework
- **NestJS** - Enterprise framework (builds on Express/Fastify)

**Protocol Expansion:**

- **MCP (Model Context Protocol)** - AI tool servers
- **GraphQL** - Query language for APIs
- **WebSocket** - Bidirectional real-time

**Additional Frameworks:**

- **Elysia.js** - Bun-first framework
- **Next.js API Routes** - Full-stack React

> **Vision's Promise:** Add any adapter, get all features.
> Tracing, testing, monitoring, catalog - works for every protocol.

---

## 🤝 Contributing

This project is in **early development**. Contributions are welcome!

---

  ## 📄 License
 
 Core is licensed under **MIT** (c) 2025 Ihor Kolobanov. See `LICENSE`.

---

## 🙏 Acknowledgments

Inspired by [Encore](https://encore.dev)'s excellent Development Dashboard, but designed to be framework-agnostic and
fully open-source.
