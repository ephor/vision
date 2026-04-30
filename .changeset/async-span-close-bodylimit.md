---
"@getvision/server": patch
---

**New: `close(app)` teardown API** — gracefully drains BullMQ workers, stops the Vision Dashboard WebSocket server, and terminates Drizzle Studio. Idempotent (concurrent calls share one in-flight promise). Available as both `close(app)` top-level export and `app.close()` instance method. Automatically registered with `import.meta.hot?.dispose` for `bun --hot` HMR when using `.listen()`.

**Fix: async spans now capture real IO duration** — `span()` detects when the callback returns a `Promise` and defers `endSpan()` until the promise settles, so async operations (Redis, HTTP, DB) show accurate timing in the waterfall.

**New: trace context propagation for event/cron handlers** — `emit()` forwards the caller's `traceId`/`spanId` through the BullMQ job envelope; `registerHandler` and `registerCronHandler` receive `EventBusTraceContext` as a second argument, enabling distributed tracing across pub/sub boundaries.

**Docs: Elysia package scope alignment** — updated all references from `@elysiajs/cors`, `@elysiajs/eden`, `@elysiajs/jwt` to the current `@elysia/*` scope (`@elysiajs/swagger` left unchanged — not yet published under new scope).
