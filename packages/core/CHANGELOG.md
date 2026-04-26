# @getvision/core

## 0.2.1

### Patch Changes

- eaf25c9: Introduced functionality to manage global and tab-specific headers in the API Explorer. Headers are persisted locally and dynamically applied to requests, allowing for greater customization and flexibility.

## 0.2.0

### Minor Changes

- 767bb3e: Rewrite `@getvision/server` on Elysia with a module-first API, type-safe events, and first-class Next.js App Router support.

  See the full migration guide under Docs → Vision Server → Migration guide.

  ### Breaking changes (`@getvision/server`)
  - **HTTP framework**: Hono replaced with Elysia. Handler context and routing semantics now follow Elysia.
  - **API reshaped around `createVision` + `createModule`**. The previous `Vision` class, service builder, and file-based autodiscovery are removed.
  - **Removed**: `new Vision(...)`, `app.service(name).endpoint(...)`, `.on(name, handler)` without a schema, `.cron(expr, handler, { id })`, `routes: { autodiscover, dirs }`, and the old service / router / types internals.
  - **Handler context** is now destructured (`{ body, params, query, span, addContext, emit, traceId, set }`) instead of a Hono `c` object; `return value` replaces `c.json(value)`.

  ### New APIs (`@getvision/server`)
  - `createVision(config)` — top-level app factory. Returns an Elysia instance augmented with `ready()`.
  - `createModule({ prefix })` — composable module primitive. Decorates handlers with `span`, `addContext`, `traceId`, `emit`.
  - `defineEvents({ [name]: { schema, handler, ... } })` — Elysia plugin that registers pub/sub handlers and installs a **type-safe `emit`** narrowed to the declared event map.
  - `defineCrons({ [name]: { schedule, handler, ... } })` — colocated cron registration.
  - `onEvent(decorator, name, cfg)` / `onEvents(decorator, map)` — imperative event subscription for advanced composition.
  - `ready(app)` — async, idempotent initialization. Covers both `.listen()` and `.handle()` (Next.js / WinterCG / serverless) paths.
  - `rateLimit({ requests, window, store?, keyBy?, message? })` + `MemoryRateLimitStore` — per-route rate limiting as an Elysia `beforeHandle` hook.
  - `getVisionContext()` — retrieve the current Vision ALS context (`vision`, `traceId`, `rootSpanId`) anywhere in request scope.
  - New types: `VisionConfig`, `VisionDerived`, `VisionALSContext`, `EventConfig`, `EventMap`, `EventPayload`, `TypedEmit`, `CronConfig`, `CronMap`, `RateLimitOptions`, `RateLimitContext`, `RateLimitEntry`, `RateLimitStore`.

  ### Type-safe `emit`
  - `defineEvents<const M>(events: M)` narrows `emit` to `<K extends keyof M>(name: K, data: EventPayload<M[K]>) => Promise<void>`. Event names and payloads are checked against the schema at compile time.
  - `createModule` installs an uncallable `emit` placeholder so the field is always present on the context type; the narrow callable overload is added by `.use(defineEvents(...))`.

  ### Next.js App Router support
  - New Next.js example demonstrates catch-all mounting:
    - a pure bridge route handler that strips `/api` and forwards to `app.handle(req)`;
    - an `instrumentation` hook that runs `ready(app)` at server boot so the Dashboard is live before the first request.
  - HMR is handled transparently: an internal `onRequest` hook idempotently re-runs `ready()` on fresh module instances, keeping Dashboard metadata in sync with edited handlers without leaking `ready()` into user route files.
  - Fetch-compatible `.handle(req)` path produces the same lifecycle guarantees as `.listen()`.

  ### Runtime & HMR
  - `VisionCore`, Dashboard WebSocket server, and the event registry are cached on `globalThis` so Turbopack / HMR reloads reuse port bindings and Redis sockets.
  - `defineEvents` / `defineCrons` queues are deduplicated by name; HMR replaces the closure and re-registers on the next `ready()` cycle.
  - Graceful `EADDRINUSE` handling — the Dashboard port is TCP-probed before binding.

  ### Pub/Sub
  - BullMQ-backed event bus with `pubsub: { devMode: true }` for in-memory operation (no Redis required in development).
  - Zod / Valibot / TypeBox schemas accepted via Standard Schema.

  ### `@getvision/core`
  - WebSocket server is now side-effect-free at construction; `start()` explicitly binds the port.
  - Service / route / event refresh API surfaced for HMR consumers.
  - Additional types exported for use by `@getvision/server`.

  ### Examples & docs
  - The standalone example was rewritten to the module pattern.
  - A new Next.js example was added (App Router + Eden Treaty + React Query).
  - Docs rewritten: server overview, concepts, quickstart; new modules and migration chapters added; file-based-routing and service-builder chapters removed.

## 0.1.1

### Patch Changes

- 5b7cb0a: feat(web): add query parameters support, custom query params, and polished UI

  Introduced support for API query parameters in the API Explorer, including the ability to add and manage custom query parameters. Refactored UI components to use a new `Checkbox` component and replaced `Card` with `SectionCard` for better consistency. Enhanced request body handling with JSON5 parsing.

## 0.1.0

### Minor Changes

- d5bfbe0: Introduce UniversalValidator with multi-library validation support for Zod, Valibot, and Standard Schema v1. Enhanced template generation now handles complex schemas with nested objects, arrays, enums, and union types.

## 0.0.8

### Patch Changes

- 2635948: Implement Wide Events concept for logging

## 0.0.7

### Patch Changes

- 96f97ad: Add apiUrl config param for adapters

## 0.0.6

### Patch Changes

- 633a138: Inject dashboard config into index.html via apiUrl and serveStatic
  Make VisionWebSocketServer options accept optional apiUrl

## 0.0.5

### Patch Changes

- d227b1d: Layout imporovements, detect drizzle runnig process

## 0.0.4

### Patch Changes

- a88ad97: Fix UI layout for events

## 0.0.2

### Patch Changes

- ae8b128: Fix production exports to dist and switch to tsc build for d.ts

## 0.0.0

### Patch Changes

- 368618d: Initial release
- 092c5c4: Remove legacy fallback ui
