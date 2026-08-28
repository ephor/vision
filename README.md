<div align="center">
  <img src="apps/docs/public/logo.svg" width="76" alt="Vision logo" />
  <h1>Vision</h1>
</div>

[![npm version](https://img.shields.io/npm/v/@getvision/server.svg)](https://www.npmjs.com/package/@getvision/server)
[![npm downloads](https://img.shields.io/npm/dm/@getvision/server.svg)](https://www.npmjs.com/package/@getvision/server)
[![CI](https://github.com/ephor/vision/actions/workflows/ci.yml/badge.svg)](https://github.com/ephor/vision/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/ephor/vision.svg?style=social)](https://github.com/ephor/vision/stargazers)

**Production-ready TypeScript server with built-in observability, queues & scheduling**

Vision is a production-ready TypeScript server (`@getvision/server`, built on Elysia) with a self-hosted dashboard — live request traces, contextual logs, route discovery, and a schema-aware API playground. Use it as your app server, or add observability to an existing Express, Fastify, or Hono app via adapters. BullMQ pub/sub & cron built in (in-memory dev, Redis prod), OTLP export to any backend. MIT, self-hosted, no vendor lock-in.

> REST observability today, with GraphQL, tRPC, and MCP on the [roadmap](#roadmap).

> [!IMPORTANT]
> Vision can run in production, but the dashboard has no authentication by default and may capture request headers and bodies. Do not expose its port publicly; keep it on a private network and access it through SSH or Kubernetes port forwarding, or place it behind an authenticated proxy. See the [deployment guide](https://getvision.dev/docs/deployment).

<!-- TODO: replace screenshot with animated demo GIF -->
<div align="center">
  <img src="https://github.com/user-attachments/assets/a0f46bbd-901f-48ed-966c-4f456a71b2d5" alt="Vision Dashboard - API observability and testing interface" width="800"/>
</div>

---

## Why Vision

Observability for APIs usually means a tradeoff. **Encore.ts** gives you a built-in dashboard, but only if you rebuild your app on its framework and runtime. **OpenTelemetry** gives you a vendor-neutral standard, but it's plumbing — you wire up an SDK, a collector, and a backend before you see anything.

Vision drops into the Express, Fastify, or Hono app you already have — two lines of code, no rewrite — and gives you live traces, logs, and a request playground in your browser while you build. Prefer to start clean? `@getvision/server` is the full TypeScript server with Vision built in — observability plus BullMQ-backed pub/sub & cron out of the box (built on Elysia). Self-hosted, runs alongside your app, you keep your code.

**Develop with Vision locally → ship the same traces to whatever prod backend you already run (Grafana, Honeycomb, Datadog, OTel Collector).**

### Vision vs. Encore.ts

The closest comparison is **Encore.ts** — it also pairs API code with an auto-generated dashboard. The difference is what you give up to get one:

|                                          | **Vision**                                                | **Encore.ts**                                         |
| ---------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------- |
| Setup                                    | ~2 lines in an app you already have                       | Rewrite onto Encore's runtime/SDK                     |
| Works with existing Express/Fastify/Hono | Yes — drop-in middleware                                  | No — you adopt Encore's framework                     |
| Runtime / infrastructure lock-in         | Low with adapters; Elysia coupling with Vision Server     | High with Encore APIs and infrastructure primitives   |
| Built-in dashboard / UI                  | Yes — traces, logs, request playground                    | Yes — local dev dashboard + cloud                     |
| Multi-protocol (REST/GraphQL/tRPC/MCP)   | REST today; GraphQL, tRPC, MCP on the [Roadmap](#roadmap) | REST/RPC via Encore's own framework                   |
| Validation library integration           | Zod, Valibot, Standard Schema v1 (auto request templates) | Encore's own validation (TypeScript types → API)      |
| Managed cloud targets                    | Any compatible Node.js or Bun host                        | AWS and GCP                                           |
| OpenTelemetry / OTLP export              | Yes — OTLP/HTTP for traces and logs                       | Requires separate OpenTelemetry instrumentation       |
| Self-hosted                              | Yes (in-process dashboard)                                | Yes, self-hostable; cloud platform optional           |
| License / cost                           | MIT, free                                                 | Apache 2.0 (open source) + paid Encore Cloud platform |

---

## Features

### Multi-Protocol Support

- REST API tracing and exploration today
- GraphQL, tRPC, and Model Context Protocol (MCP) support on the roadmap
- Service catalog with auto-discovery

### Validation Library Integration

- **Zod** - Full feature support
- **Valibot** - Modern validation support
- **Standard Schema v1** - Universal compatibility
- Automatic request template generation
- Real-time validation error display

### Queues & Scheduling (via `@getvision/server`)

- **Pub/sub events** — `defineEvents()` + `emit()` — typed, validated (Zod/Valibot), powered by BullMQ
- **Cron / repeatable jobs** — `defineCrons({ schedule: '0 0 * * *' })` — backed by BullMQ repeatable jobs (atomic claim, key-based dedup — no extra ShedLock needed)
- **Retry with backoff** — `attempts: 3` + exponential backoff native
- **Failed jobs are queryable/re-drivable** via BullMQ's `failed` set (no separate DLQ — intentional; failed set covers SOW §3.4 delivery-status/audit needs)
- **Dev mode** — in-memory (no Redis); production — Redis (`REDIS_URL` / `pubsub.redis`)

### Development Tools

- API playground with multi-tab testing
- Live logs with trace context
- Performance monitoring
- TypeScript-first implementation

### Export & Integration

- OTLP/HTTP export for traces and logs through `@getvision/server`'s `vision.exporters` configuration, compatible with Honeycomb, Grafana Tempo, Better Stack, Datadog, OpenTelemetry Collector, and other OTLP backends. See [OTLP Export](https://getvision.dev/docs/server#otlp-export).

---

## Logging Philosophy

Vision implements the **Wide Events** logging approach - add context once, see it everywhere. This method provides:

- Structured logging with automatic context propagation
- Trace-aware log grouping
- Reduced noise while maintaining full observability

---

## Quick Start

### Add to Existing App (Express Example)

```bash
bun add @getvision/adapter-express express zod
# or: npm install @getvision/adapter-express express zod
```

```typescript
import express from "express";
import {
  enableAutoDiscovery,
  validator,
  visionMiddleware,
} from "@getvision/adapter-express";
import { z } from "zod"; // or v from 'valibot'!

const app = express();

// Add Vision in development
if (process.env.NODE_ENV !== "production") {
  app.use(visionMiddleware({ port: 9500 }));
}

app.use(express.json());

// Your existing endpoints - now with Vision!
app.post(
  "/users",
  // Automatic template generation!
  validator(
    "body",
    z.object({
      name: z.string(),
      email: z.string().email(),
    }),
  ),
  (req, res) => {
    // req.body is fully typed and validated
    res.json(req.body);
  },
);

// Discover routes after registering them
if (process.env.NODE_ENV !== "production") {
  enableAutoDiscovery(app);
}

app.listen(3000);
// Dashboard at http://localhost:9500
```

### Start from Scratch (Elysia-based)

```bash
bun add @getvision/server elysia zod
```

```typescript
import { createVision, createModule } from "@getvision/server";
import { z } from "zod";

const usersModule = createModule({ prefix: "/users" }).post(
  "/",
  async ({ body }) => ({ id: crypto.randomUUID(), ...body }),
  { body: z.object({ name: z.string(), email: z.string().email() }) },
);

createVision({ service: { name: "My API" } })
  .use(usersModule)
  .listen(3000);
// Dashboard at http://localhost:9500
```

---

## Supported Frameworks

- **Elysia** (via `@getvision/server`) - Stable
- **Next.js** (App Router catch-all) - Stable
- **Express** (via adapter) - Stable
- **Fastify** (via adapter) - Stable
- **Hono** (via adapter) - Stable

---

## Roadmap

- [x] REST
- [x] OpenTelemetry export
- [ ] GraphQL
- [ ] tRPC
- [ ] MCP

See the full [roadmap](https://getvision.dev/docs/roadmap) for details on what's planned.

---

## Documentation

Full documentation at **[getvision.dev/docs](https://getvision.dev/docs)**

- [Getting Started](https://getvision.dev/docs/quickstart)
- [Validation Libraries](https://getvision.dev/docs/validation)
- [Hono Adapter](https://getvision.dev/docs/adapters/hono)
- [Express Adapter](https://getvision.dev/docs/adapters/express)
- [Fastify Adapter](https://getvision.dev/docs/adapters/fastify)
- [Deployment](https://getvision.dev/docs/deployment)

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, development, and pull request guidelines.

## License

Vision is available under the [MIT License](./LICENSE).
