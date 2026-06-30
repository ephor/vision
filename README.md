# Vision 🔮

<!-- TODO: no `gh` CLI access from this environment to set repo topics. Run manually:
gh repo edit ephor/vision --add-topic observability,elysiajs,typescript,apm,tracing,devtools,api-testing -->

[![npm version](https://img.shields.io/npm/v/@getvision/server.svg)](https://www.npmjs.com/package/@getvision/server)
[![npm downloads](https://img.shields.io/npm/dm/@getvision/server.svg)](https://www.npmjs.com/package/@getvision/server)
[![CI](https://github.com/ephor/vision/actions/workflows/ci.yml/badge.svg)](https://github.com/ephor/vision/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/ephor/vision.svg?style=social)](https://github.com/ephor/vision/stargazers)

**Universal observability dashboard for API development**

Vision is a development dashboard that provides unified observability across protocols and validation libraries. Add it to your existing Express, Fastify, or Hono application.

> Protocol-agnostic monitoring with support for REST today — see the [Roadmap](#roadmap) for GraphQL, tRPC, and MCP

<!-- TODO: replace screenshot with animated demo GIF -->
<div align="center">
  <img src="https://github.com/user-attachments/assets/a0f46bbd-901f-48ed-966c-4f456a71b2d5" alt="Vision Dashboard - API observability and testing interface" width="800"/>
</div>

---

## Why Vision

Observability for APIs usually means a tradeoff. **Encore.ts** gives you a built-in dashboard, but only if you rebuild your app on its framework and runtime. **OpenTelemetry** gives you a vendor-neutral standard, but it's plumbing — you wire up an SDK, a collector, and a backend before you see anything.

Vision drops into the Express, Fastify, or Hono app you already have — two lines of code, no rewrite — and gives you live traces, logs, and a request playground in your browser while you build. Prefer to start clean? `@getvision/server` is an Elysia-based meta-framework with Vision built in. It's self-hosted, runs alongside your app, and you keep your code — and when you're ready to ship telemetry to production, Vision speaks OTLP, so the same traces export straight into your OpenTelemetry backend.

### Vision vs. Encore.ts

The closest comparison is **Encore.ts** — it also pairs API code with an auto-generated dashboard. The difference is what you give up to get one:

|                                          | **Vision**                                                | **Encore.ts**                                         |
| ---------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------- |
| Setup                                    | ~2 lines in an app you already have                       | Rewrite onto Encore's runtime/SDK                     |
| Works with existing Express/Fastify/Hono | Yes — drop-in middleware                                  | No — you adopt Encore's framework                     |
| Vendor / code lock-in                    | None                                                      | High — app is built on Encore's framework             |
| Built-in dashboard / UI                  | Yes — traces, logs, request playground                    | Yes — local dev dashboard + cloud                     |
| Multi-protocol (REST/GraphQL/tRPC/MCP)   | REST today; GraphQL, tRPC, MCP on the [Roadmap](#roadmap) | REST/RPC via Encore's own framework                   |
| Validation library integration           | Zod, Valibot, Standard Schema v1 (auto request templates) | Encore's own validation (TypeScript types → API)      |
| OpenTelemetry / OTLP export              | Yes — OTLP/HTTP, shipped                                  | Announced, coming soon                                |
| Self-hosted                              | Yes (in-process dashboard)                                | Yes, self-hostable; cloud platform optional           |
| License / cost                           | MIT, free                                                 | Apache 2.0 (open source) + paid Encore Cloud platform |

_OpenTelemetry isn't on this list on purpose — it's a standard Vision exports to, not a competitor. Vision is the dev-time UX; OTel is the wire format for shipping those traces to whatever backend you run. Comparison based on each project's public docs as of writing; correct an inaccuracy by opening an issue or PR._

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

### Export & Integration

- OpenTelemetry export (new) - OTLP/HTTP exporter (`@getvision/server` `vision.exporters`) for sending traces to Honeycomb, Grafana Tempo, BetterStack, an OTel Collector, or any OTLP-compatible backend

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
import express from "express";
import { visionAdapter } from "@getvision/adapter-express";
import { z } from "zod"; // or v from 'valibot'!

const app = express();

// Add Vision in development
if (process.env.NODE_ENV !== "production") {
  app.use("*", visionAdapter({ port: 9500 }));
}

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
- [x] OpenTelemetry export (new)
- [ ] GraphQL
- [ ] tRPC
- [ ] MCP

See the full [roadmap](https://getvision.dev/docs/roadmap) for details on what's planned.

---

## Documentation

Full documentation at **[getvision.dev/docs](https://getvision.dev/docs)**

- [Getting Started](https://getvision.dev/docs/quickstart)
- [Validation Libraries](https://getvision.dev/docs/validation)
- [Adapter Guides](https://getvision.dev/docs/adapters)
- [Deployment](https://getvision.dev/docs/deployment)

---
