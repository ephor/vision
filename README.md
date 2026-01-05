# Vision 🔮

**Universal Observability for Modern Apps - One tool for all protocols**

Vision is a universal development dashboard that supports **any protocol** your app uses: REST APIs, tRPC, MCP (Model
Context Protocol), GraphQL, and more. Protocol-agnostic and fully open source.

> 🎯 **One Dashboard. All Protocols.**
> Why juggle Postman, Thunder Client, MCPJam, and other tools when Vision handles everything?

## Why Vision?

- **One dashboard, many protocols** — REST, GraphQL, tRPC, MCP.
- **Wide Events Logging** — add context once, see it everywhere.
- **Meta‑framework on Hono** — ship fast with the built‑in Vision Server.
- **Adapters for existing apps** — Express, Fastify, Hono (more coming).
- **Tracing, logs, testing** — unified view, live updates.
- **Open source, self‑hosted** — MIT core, no vendor lock‑in.

---

## 🎯 Adapters & Platforms

- Available today: **Hono**, **Express**, **Fastify**.
- Planned: **tRPC**, **NestJS**, **GraphQL**, **MCP**, **WebSocket**, **Next.js API Routes**, **Elysia**.

Add an adapter, get the same tracing, testing, monitoring, and service catalog.

---

## ✨ Features (at a glance)

- **Cross‑protocol tracing** with a unified waterfall view
- **API playground** with multi‑tab testing
- **Live logs** with smart badges, trace grouping, and context search
- **Service catalog** with auto‑discovery
- **Dark/Light UI**, persistence, and small UX niceties

## 📚 Documentation

Full documentation available at **[getvision.dev](https://getvision.dev/docs)**

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

## ⚙️ Usage

Two ways to use Vision:

### 1) Vision Server (Hono‑based, recommended for new apps)

```ts
import { Vision } from '@getvision/server'
import { z } from 'zod'

const app = new Vision({ service: { name: 'My App' } })

app.service('users').endpoint('GET', '/users/:id', {
  input: z.object({ id: z.string() }),
  output: z.object({ id: z.string(), name: z.string() })
}, async ({ id }, c) => {
  // Tracing is built into the context
  const user = c.span('db.select', { 'db.table': 'users' }, () => ({ id, name: 'John' }))
  return user
})

app.start(3000)
```

### 2) Adapters (add Vision to an existing app)

```ts
// Hono
import { Hono } from 'hono'
import { visionAdapter, useVisionSpan } from '@getvision/adapter-hono'

const app = new Hono()
if (process.env.NODE_ENV !== 'production') {
  app.use('*', visionAdapter({ port: 9500 }))
}
app.get('/hello', (c) => {
  const withSpan = useVisionSpan()
  const payload = withSpan('compute.greeting', { 'app.part': 'hello' }, () => ({ hello: 'world' }))
  return c.json(payload)
})
export default app
```

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
