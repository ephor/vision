# @getvision/server

## 1.0.0

### Major Changes

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

### Patch Changes

- 61ad392: update BullMQ compatibility and improve configurations
- 44d79d9: configure @getvision/server for proper module exports and update dependency versions.
- b91cc1f: Prevent buffering streaming responses in onAfterHandle hookAdded detection for streaming responses (SSE, NDJSON, AI SDK streams) via content-type headers and ReadableStream body checks. Record `<stream>` placeholder in trace instead of cloning and awaiting response body, which would block chunk flush to client until generation completes.
- Updated dependencies [767bb3e]
  - @getvision/core@0.2.0

## 0.4.3

### Patch Changes

- d4c761e: Enhance Redis connection handling and documentation

  Added robust Redis connection handling with configurable options including `keepAlive`, `maxRetriesPerRequest`, `enableReadyCheck`, `connectTimeout`, and `enableOfflineQueue`. Updated documentation with improved troubleshooting guides, environment variable support, and connection customization examples for stability in production environments.

## 0.4.2

### Patch Changes

- 3b8f782: Add configurable BullMQ options for queue, worker, and queue events
- 107ad21: bump package versions in bun.lock

## 0.4.1

### Patch Changes

- 5b7cb0a: feat(web): add query parameters support, custom query params, and polished UI

  Introduced support for API query parameters in the API Explorer, including the ability to add and manage custom query parameters. Refactored UI components to use a new `Checkbox` component and replaced `Card` with `SectionCard` for better consistency. Enhanced request body handling with JSON5 parsing.

- Updated dependencies [5b7cb0a]
  - @getvision/core@0.1.1

## 0.4.0

### Minor Changes

- 6e5c887: Migrate all adapters to use UniversalValidator supporting Zod, Valibot, and Standard Schema v1. The new validation system provides:
  - Unified `validator()` function that works with any validation library
  - Automatic error response formatting with proper issue paths
  - Schema introspection for template generation
  - Backward compatibility with existing zValidator (deprecated)

  **Breaking changes:**
  - `zValidator` is now deprecated in favor of universal `validator()`
  - Error response format has been standardized across all adapters
  - Some internal types have changed to support multiple validation libraries

  Migration guide:

  ```ts
  // Before
  import { zValidator } from "@getvision/adapter-hono";
  app.post("/users", zValidator("json", userSchema));

  // After (works with Zod, Valibot, or Standard Schema)
  import { validator } from "@getvision/adapter-hono";
  app.post("/users", validator("json", userSchema));
  ```

## 0.3.6

### Patch Changes

- Updated dependencies [d5bfbe0]
  - @getvision/core@0.1.0

## 0.3.5

### Patch Changes

- 5fbff2a: bump deps versions

## 0.3.4

### Patch Changes

- 22facf0: Implement Wide Events concept for logging

## 0.3.3

### Patch Changes

- Updated dependencies [2635948]
  - @getvision/core@0.0.8

## 0.3.2

### Patch Changes

- 90d1d3a: Added full request/response mocking to event context including header manipulation, status codes, and proper Request object initialization.
  Removed premature event registry cleanup during hot-reload to prevent memory issues.

## 0.3.1

### Patch Changes

- 9c3a582: Improve hot-reload cleanup and prevent memory leaks during development
- 3b055ce: clean events and workers to avoid memory leaks

## 0.3.0

### Minor Changes

- 28c86e6: Added support for runtime-specific `start` options. Introduced new `VisionStartOptions` type for better handling of configuration parameters.
  Added support for configurable worker concurrency per handler and default event bus settings

### Patch Changes

- 2d4e753: Fix priority for dynamic and static routes

## 0.2.7

### Patch Changes

- d4ccf5d: Expose `apiUrl` in adapter and server options and pass it to VisionCore so the dashboard can target the backend API.

## 0.2.6

### Patch Changes

- Updated dependencies [96f97ad]
  - @getvision/core@0.0.7

## 0.2.5

### Patch Changes

- Updated dependencies [633a138]
  - @getvision/core@0.0.6

## 0.2.4

### Patch Changes

- b0ab5ad: Run in Bun environment if Bun was detected

## 0.2.3

### Patch Changes

- Updated dependencies [d227b1d]
  - @getvision/core@0.0.5

## 0.2.2

### Patch Changes

- 94b139b: Bump @hono/node-server to 1.19.6
- da87b81: Update router to pass EventBus from root app to file-based sub-apps
- Updated dependencies [a88ad97]
  - @getvision/core@0.0.4

## 0.2.1

### Patch Changes

- ec9cf8b: Redis password is now passed correctly and REDIS_URL is honored.
- d0f3a53: Add event handler context

  Event handlers receive a Hono-like `Context` as the second argument. You can run service-level middleware to inject resources using `c.set(...)` and then access them in the handler via `c.get(...)`.

- 648a711: If Redis is configured use production mode in PubSub

## 0.2.0

### Minor Changes

- b49d8db: Added per-endpoint rate limiting with hono-rate-limiter: configure ratelimit in EndpointConfig with requests, window, and optional store for distributed caching. Includes docs and example.

## 0.1.0

### Minor Changes

- 5d94ff9: Thread Hono generics across Vision and ServiceBuilder, add type-safe

### Patch Changes

- ae8b128: Fix production exports to dist and switch to tsc build for d.ts
- Updated dependencies [ae8b128]
  - @getvision/core@0.0.2

## 0.0.0

### Patch Changes

- 368618d: Initial release
- Updated dependencies [368618d]
- Updated dependencies [092c5c4]
  - @getvision/core@0.0.0
