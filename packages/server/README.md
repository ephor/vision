# @getvision/server

**Meta-framework with built-in observability — everything you need, nothing you don't.**

Built on Elysia. Automatic tracing. Type-safe APIs. Pub/Sub & Cron. Zero config. Eden Treaty ready.

## Why Vision Server?

**vs NestJS:** Orders of magnitude faster, zero DI ceremony, built-in observability
**vs Encore.ts:** 100% open source (MIT), no vendor lock-in
**vs Plain Elysia:** Built-in observability, pub/sub & cron, rate limiting, module pattern

## Quick Start

```bash
bun add @getvision/server elysia zod
```

```typescript
import { createVision, createModule, defineEvents } from '@getvision/server'
import { z } from 'zod'

const usersModule = createModule({ prefix: '/users' })
  .use(
    defineEvents({
      'user/created': {
        schema: z.object({ userId: z.string(), email: z.string().email() }),
        handler: async (event) => {
          console.log('[welcome email] →', event.email)
        },
      },
    })
  )
  .get('/', ({ span }) => {
    const users = span('db.select', { 'db.table': 'users' }, () => [
      { id: '1', name: 'Alice' },
    ])
    return { users }
  })
  .post(
    '/',
    async ({ body, emit }) => {
      const id = crypto.randomUUID()
      await emit('user/created', { userId: id, email: body.email })
      return { id, ...body }
    },
    { body: z.object({ name: z.string(), email: z.string().email() }) }
  )

const app = createVision({
  service: { name: 'My API', version: '1.0.0' },
  pubsub: { devMode: true },
}).use(usersModule)

app.listen(3000)

/** Eden Treaty client type — export for the frontend. */
export type AppType = typeof app
```

**That's it!** You get:

- ✅ Vision Dashboard on port 9500
- ✅ Automatic request tracing
- ✅ Type-safe validation (Zod / Valibot / TypeBox via Standard Schema)
- ✅ Pub/Sub events (BullMQ-based, in-memory in dev)
- ✅ Eden Treaty client support — `treaty<typeof app>`

## The Module Pattern

Vision composes apps from small, focused **modules**. A module is an Elysia plugin with Vision's per-request context (`span`, `emit`, `addContext`, `traceId`) already typed in.

```typescript
const ordersModule = createModule({ prefix: '/orders' })
  .use(defineEvents({ 'order/placed': { schema, handler } }))
  .post(
    '/',
    async ({ body, emit }) => {
      await emit('order/placed', { orderId: '...', total: body.total })
      return { ok: true }
    },
    { body: OrderBody }
  )
```

Compose at the root via `.use()` — order doesn't matter, and each module contributes its own routes, events, and crons:

```typescript
const app = createVision({ service: { name: 'Shop' } })
  .use(usersModule)
  .use(ordersModule)
  .use(productsModule)
```

## Features

### 🚀 Zero configuration

Everything works out of the box:

- Vision Dashboard starts automatically on port 9500
- Tracing hooks are pre-wired (`onRequest`, `onAfterResponse`, `onError`)
- Service & route catalog auto-registered (once on `listen`, or lazily on first request for `.handle(req)` deployments like Next.js)
- BullMQ event bus auto-initialized (in-memory in `devMode`, Redis in production)

### 🔥 `span` / `emit` / `addContext` / `traceId` in every handler

Every HTTP handler receives Vision's context alongside Elysia's `body/query/params`:

```typescript
.post('/', async ({ body, span, emit, addContext, traceId }) => {
  addContext({ 'user.email': body.email })

  const user = span('db.insert', { 'db.table': 'users' }, () => {
    return db.users.create(body)
  })

  await emit('user/created', { userId: user.id, email: user.email })
  return { ...user, traceId }
})
```

### ✅ Validation with any Standard Schema library

Use Zod, Valibot, or Elysia's built-in TypeBox (`t`) — all interchangeable, mix per route:

```typescript
import { t } from '@getvision/server'
import { z } from 'zod'
import * as v from 'valibot'

.post('/', handler, { body: z.object({ name: z.string() }) })           // Zod
.post('/', handler, { body: v.object({ name: v.string() }) })           // Valibot
.post('/', handler, { body: t.Object({ name: t.String() }) })           // TypeBox
```

Invalid request → Elysia returns a `422` with validation details automatically.

### 📡 Built-in pub/sub & cron

Powered by BullMQ — in-memory during development, Redis-backed in production:

```typescript
import { createModule, defineEvents, defineCrons } from '@getvision/server'

const notificationsModule = createModule()
  .use(
    defineEvents({
      'user/created': {
        schema: z.object({ userId: z.string(), email: z.string() }),
        description: 'User account created',
        icon: '👤',
        tags: ['user', 'auth'],
        handler: async (event) => {
          await sendWelcomeEmail(event.email)
        },
      },
    })
  )
  .use(
    defineCrons({
      'nightly-cleanup': {
        schedule: '0 0 * * *',
        handler: async () => {
          await db.sessions.deleteExpired()
        },
      },
    })
  )
```

Emit events from any handler using the context:

```typescript
await emit('user/created', { userId: '123', email: 'user@example.com' })
```

Trace context (`traceId`/`spanId`) is propagated through the BullMQ job envelope, so event/cron handlers join the same trace as the request that emitted them.

### 🎯 Elysia-native

The underlying instance is Elysia — every plugin and feature works unmodified:

```typescript
import { cors } from '@elysia/cors'
import { swagger } from '@elysiajs/swagger'

const app = createVision({ service: { name: 'My API' } })
  .use(cors())
  .use(swagger())
  .use(usersModule)
  .get('/health', () => ({ status: 'ok' }))
```

### 🔒 Per-endpoint rate limiting

```typescript
import { rateLimit } from '@getvision/server'

.post('/', handler, {
  body: SignupBody,
  beforeHandle: [rateLimit({ requests: 5, window: '15m' })],
})
```

Module-level — apply once to every route in the module:

```typescript
const adminModule = createModule({ prefix: '/admin' })
  .onBeforeHandle(rateLimit({ requests: 10, window: '30s' }))
  .get('/stats', handler)
  .delete('/sessions/:id', handler)
```

### 🧩 Eden Treaty — typed RPC on the client

```typescript
import { treaty } from '@elysia/eden'
import type { AppType } from './server'

const api = treaty<AppType>('http://localhost:3000')

const { data } = await api.users.get()
//         ^? { users: { id: string; name: string }[] }
```

Change a schema on the server → the client gets a compile error. No codegen.

### 🔮 Vision Dashboard

Visit `http://localhost:9500` after starting your app:

- 📊 Real-time request tracing with waterfall visualization
- 📝 Live logs (linked to the trace that emitted them)
- 🏗️ Service, route, event and cron catalog
- 🧪 API Explorer — auto-generated request templates from your schemas
- 📈 Performance metrics

## Configuration

```typescript
const app = createVision({
  service: {
    name: 'My API',
    version: '1.0.0',
    description: 'Optional description',
    integrations: {
      database: 'postgresql://localhost/mydb',
      redis: 'redis://localhost:6379',
    },
    drizzle: {
      autoStart: true, // auto-start Drizzle Studio in dev
      port: 4983,
    },
  },
  vision: {
    enabled: true,    // enable/disable dashboard
    port: 9500,       // dashboard port
    maxTraces: 1000,
    maxLogs: 10000,
    logging: true,
    // exporters: [...] // forward traces to OTLP backends — see below
  },
  pubsub: {
    devMode: true,    // in-memory queue — no Redis required
    // redis: { host: 'localhost', port: 6379 }
  },
})
```

## OTLP Trace Export

Forward every completed trace to any OpenTelemetry-compatible backend — BetterStack, Honeycomb, Grafana Tempo, Datadog, an OTel Collector, and so on — by adding an `OtlpTraceExporter` to `vision.exporters`. Export runs alongside the local Dashboard, so traces show up in both.

```typescript
import { createVision, OtlpTraceExporter } from '@getvision/server'

createVision({
  service: { name: 'my-api' },
  vision: {
    exporters: [
      new OtlpTraceExporter({
        endpoint: 'https://<host>/v1/traces',         // OTLP/HTTP traces endpoint
        headers: { Authorization: 'Bearer <token>' }, // backend auth
        serviceName: 'my-api',
      }),
    ],
  },
})
```

The exporter speaks OTLP/JSON over HTTP — the destination is purely a matter of `endpoint` + `headers`, so the same code targets any OTLP backend (switching from BetterStack to Honeycomb is a URL + header change, not a code change). Traces are buffered and flushed in batches; failed batches are re-buffered for the next flush so a transient backend outage doesn't silently lose traces, and a failing exporter is isolated so it never affects request handling.

Vision models each HTTP request as a synthetic root span (`SERVER`) with your `span(...)` calls as nested `INTERNAL` spans, and attaches the trace's logs as span events.

**`OtlpTraceExporter` options**

| Option | Default | Description |
| --- | --- | --- |
| `endpoint` | _(required)_ | OTLP/HTTP traces endpoint, e.g. `https://<host>/v1/traces` |
| `headers` | `{}` | Extra headers, typically auth (e.g. `{ Authorization: 'Bearer <token>' }`). Keys are matched case-insensitively when merging with built-in defaults. |
| `serviceName` | `'unknown_service'` | `service.name` resource attribute |
| `resourceAttributes` | `{}` | Additional resource attributes (e.g. `{ 'deployment.environment': 'prod' }`) |
| `maxQueueSize` | `2048` | Hard cap on buffered traces. Excess traces (and re-buffered batches that won't fit) are dropped and surfaced via `onError`. |
| `maxExportBatchSize` | `512` | Flush eagerly once this many traces are buffered, rather than waiting for `flushIntervalMs`. |
| `flushIntervalMs` | `5000` | Background flush interval (ms) |
| `timeoutMs` | `10000` | Per-request timeout (ms) |
| `onError` | `console.warn` | Called on transport/HTTP failures and queue overflow. Pass a no-op to silence. |

> Need a custom sink (custom format, webhook, second dashboard)? Implement the `TraceExporter` interface (`export(trace)` + optional `shutdown()`) and add it to `vision.exporters` — `OtlpTraceExporter` is just the built-in one.

## API Reference

### `createVision(config)`

Create a new Vision app. Returns an Elysia instance decorated with Vision's per-request context.

```typescript
const app = createVision({
  service: { name: 'My API', version: '1.0.0' },
  pubsub: { devMode: true },
})
```

See [Configuration](#configuration) for all options.

### `createModule({ prefix? })`

Create a new module. Equivalent to `new Elysia({ prefix })` with Vision's context types pre-decorated.

```typescript
const usersModule = createModule({ prefix: '/users' })
  .get('/', handler)
  .post('/', handler, { body: schema })
```

### `defineEvents(map)`

Register pub/sub event schemas and handlers. Returns an Elysia plugin — `.use()` it inside the module that owns the events.

```typescript
createModule().use(
  defineEvents({
    'user/created': {
      schema: z.object({ userId: z.string(), email: z.string().email() }),
      description: 'User account created',
      icon: '👤',
      tags: ['user', 'auth'],
      handler: async (event) => {
        await sendWelcomeEmail(event.email)
      },
    },
  })
)
```

### `defineCrons(map)`

Register cron jobs. Returns an Elysia plugin.

```typescript
createModule().use(
  defineCrons({
    'nightly-cleanup': {
      schedule: '0 0 * * *',
      description: 'Purge expired sessions',
      handler: async () => {
        await db.sessions.deleteExpired()
      },
    },
  })
)
```

Crons run under BullMQ's repeatable jobs — in-memory in `devMode`, Redis-backed in production.

### `rateLimit(options)`

Token-bucket rate limiter. Plugs into Elysia's `beforeHandle` hook on a route or module.

```typescript
rateLimit({
  requests: 100,
  window: '1h',
  keyBy: ({ request }) => request.headers.get('x-user-id') ?? 'anonymous',
})
```

- **`requests`** — max requests per window
- **`window`** — `'30s'`, `'15m'`, `'1h'`, `'2d'`, or ms as a string
- **`keyBy`** — optional key function (defaults to client IP, falls back to `User-Agent`)
- **`store`** — optional `RateLimitStore` (defaults to in-memory `MemoryRateLimitStore`)

Exceeding the limit returns `429 Too Many Requests` with `RateLimit-*` / `Retry-After` headers.

### Handler context

Every handler receives a merged Elysia + Vision context:

```typescript
.post('/', async ({ body, params, query, set,           // Elysia
                    span, emit, addContext, traceId }) => // Vision
{ /* ... */ })
```

- **`span(name, attributes, fn)`** — wraps a block in a tracing span; returns `fn()`'s result. Detects async callbacks and defers `endSpan()` until the promise settles.
- **`emit(event, payload)`** — publishes a typed event; payload is validated against the schema from `defineEvents`.
- **`addContext(attrs)`** — adds "wide event" attributes to the current trace; subsequent logs pick them up automatically.
- **`traceId`** — current request's trace id (for error response correlation, structured logging).

### `ready(app)` / `close(app)`

```typescript
import { ready, close } from '@getvision/server'

await ready(app) // waits for dashboard, event bus, and Drizzle Studio to be up
// ... work ...
await close(app) // graceful shutdown — drains BullMQ workers, stops dashboard, terminates Drizzle Studio
```

Idempotent. `close()` is also auto-registered with `import.meta.hot?.dispose` when you use `.listen()` with `bun --hot`. Available as both top-level functions and instance methods (`app.close()`).

### `getVisionContext()`

Access the current request's Vision context from anywhere (utilities, libs called deep in the call stack). Backed by AsyncLocalStorage:

```typescript
import { getVisionContext } from '@getvision/server'

function logSomething() {
  const ctx = getVisionContext()
  ctx?.addContext({ 'lib.called': true })
}
```

### `t` (TypeBox)

Re-export of Elysia's `t` for users who prefer TypeBox over Zod/Valibot:

```typescript
import { t } from '@getvision/server'

.post('/', handler, { body: t.Object({ name: t.String() }) })
```

### `EventBus` (advanced)

The internal pub/sub class — exposed for sharing a bus across multiple apps or for manual wiring. Most users never need this.

## Drizzle Integration

Vision auto-detects Drizzle ORM and starts Drizzle Studio in development.

```typescript
const app = createVision({
  service: {
    name: 'My API',
    integrations: { database: 'sqlite://./dev.db' },
    drizzle: {
      autoStart: true, // auto-start Drizzle Studio
      port: 4983,      // default port
    },
  },
})
```

**What happens:**

1. ✅ Detects `drizzle.config.ts` in your project
2. ✅ Starts Drizzle Studio on port 4983
3. ✅ Surfaces it in the Vision Dashboard → Integrations
4. ✅ Links to https://local.drizzle.studio

Trace database calls with `span`:

```typescript
.get('/users/:id', ({ params, span }) => {
  return span('db.select', { 'db.system': 'sqlite', 'db.table': 'users' }, () => {
    return db.select().from(users).where(eq(users.id, params.id)).get()
  })
}, { params: z.object({ id: z.string() }) })
```

## Redis Configuration

`devMode: true` uses an in-memory BullMQ — no Redis required. For production, point `pubsub.redis` at your Redis instance:

```typescript
const app = createVision({
  service: { name: 'My API' },
  pubsub: {
    devMode: false,
    redis: {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      // Sensible defaults (these are the built-ins)
      keepAlive: 30000,             // prevent idle timeouts
      maxRetriesPerRequest: null,   // required null for BullMQ
      enableReadyCheck: true,
      connectTimeout: 10000,
      enableOfflineQueue: true,
    },
  },
})
```

**Troubleshooting:**

- **"Connection is closed"** — Vision auto-reconnects with exponential backoff. Check logs for `🔄 Redis reconnecting...`.
- **"Could not renew lock for job"** — long-running jobs need a longer `keepAlive`. Bump it to `60000` (60s) or more.

## Complete Example

```typescript
import {
  createVision,
  createModule,
  defineEvents,
  defineCrons,
  rateLimit,
} from '@getvision/server'
import { z } from 'zod'
import { db } from './db'
import { users, orders } from './db/schema'
import { eq } from 'drizzle-orm'

const User = z.object({ id: z.string(), name: z.string(), email: z.string().email() })

// — Users module ———————————————————————————
const usersModule = createModule({ prefix: '/users' })
  .use(
    defineEvents({
      'user/created': {
        schema: z.object({ userId: z.string(), email: z.string().email() }),
        handler: async (event) => {
          console.log('[welcome email] →', event.email)
        },
      },
    })
  )
  .get('/', ({ span }) => {
    const allUsers = span('db.select', { 'db.table': 'users' }, () =>
      db.select().from(users).all()
    )
    return { users: allUsers }
  })
  .post(
    '/',
    async ({ body, emit, span }) => {
      const user = span('db.insert', { 'db.table': 'users' }, () =>
        db.insert(users).values(body).returning().get()
      )
      await emit('user/created', { userId: user.id, email: user.email })
      return user
    },
    {
      body: z.object({ name: z.string().min(1), email: z.string().email() }),
      response: User,
      beforeHandle: [rateLimit({ requests: 5, window: '15m' })],
    }
  )

// — Orders module ——————————————————————————
const ordersModule = createModule({ prefix: '/orders' })
  .use(
    defineCrons({
      'daily-summary': {
        schedule: '0 0 * * *',
        handler: async () => console.log('Daily order summary'),
      },
    })
  )
  .post(
    '/',
    async ({ body, span }) => {
      const order = span('db.insert', { 'db.table': 'orders' }, () =>
        db.insert(orders).values({ userId: body.userId, total: 100 }).returning().get()
      )
      return { orderId: order.id }
    },
    {
      body: z.object({
        userId: z.string(),
        items: z.array(z.object({ productId: z.string(), quantity: z.number() })),
      }),
    }
  )

// — Root app ———————————————————————————————
const app = createVision({
  service: {
    name: 'E-Commerce API',
    version: '1.0.0',
    integrations: { database: 'sqlite://./dev.db' },
    drizzle: { autoStart: true, port: 4983 },
  },
  vision: { enabled: true, port: 9500 },
  pubsub: { devMode: true },
})
  .use(usersModule)
  .use(ordersModule)

app.listen(3000)

/** Eden Treaty client type — export for the frontend. */
export type AppType = typeof app
```

### Run it

```bash
# From repo root
bun run example:server

# Or directly
cd examples/vision
bun run dev
```

Visit:

- **API:** http://localhost:3000
- **Vision Dashboard:** http://localhost:9500
- **Drizzle Studio:** https://local.drizzle.studio

## Migrating from the Hono-era API

The pre-1.0 `Vision` class, `app.service(...).endpoint(...)` builder, and file-based autodiscovery have all been replaced by the Elysia module pattern. See the [migration guide](https://getvision.dev/docs/server/migration) for a complete old → new mapping.

## Why Vision Server?

### ✅ Advantages

**vs NestJS**
- Orders of magnitude faster (Bun + Elysia)
- 10× simpler — no DI, no decorators, no module graph
- Built-in observability

**vs Encore.ts**
- 100% open source (MIT)
- No vendor lock-in
- Deploy anywhere (Bun, Node, Docker, edge)

**vs plain Elysia**
- Built-in tracing, logs, API Explorer
- Type-safe pub/sub & cron
- Per-endpoint rate limiting
- Module pattern for code organization

### 🎯 Perfect For

- Greenfield projects
- API-first architectures
- Teams that want great DX
- Projects that need observability from day one
- Anyone who wants NestJS-style structure without the complexity

## Roadmap

- [x] Drizzle integration with auto-start Studio
- [x] Standard Schema validation (Zod / Valibot / TypeBox)
- [x] Pub/sub & cron via BullMQ
- [x] Per-endpoint rate limiting
- [x] OTLP trace export
- [x] Trace context propagation through pub/sub
- [ ] OpenAPI generation
- [ ] WebSocket support
- [ ] Cache layer (Redis-backed)
- [ ] Testing helpers

## License

MIT

---

**Built with ❤️ by the Vision team**
