# Refactor: Type Safety & Architecture — `@getvision/server`

## Overview

Four targeted improvements to `packages/server` that reduce runtime fragility,
eliminate `as any` casts, and improve developer experience — without breaking the public API.

---

## Issue 1 — Replace `(c as any)` with Hono Variables

### Problem

`c.span()`, `c.addContext()`, and `c.emit()` are injected onto the Hono Context via dynamic casts:

**`packages/server/src/vision-app.ts:377-408`**
```typescript
if (!(c as any).span) {
  (c as any).addContext = (context: Record<string, unknown>) => { ... }
  (c as any).span = <T>(name: string, attributes: ..., fn?: () => T): T => { ... }
}
```

**`packages/server/src/service.ts:535-590`**
```typescript
(c as any).addContext = (context: Record<string, unknown>) => { ... }
(c as any).span = <T>(...): T => { ... }
if (!(c as any).emit) {
  (c as any).emit = async <K extends keyof TEvents>(...): Promise<void> => { ... }
}
```

This bypasses TypeScript entirely. Any typo in `c.spna()` silently becomes `undefined`.

### Solution

Use Hono's built-in `Variables` system:

```typescript
// packages/server/src/types.ts — new additions

export type SpanFn = <T>(
  name: string,
  attributes?: Record<string, unknown>,
  fn?: () => T
) => T

export type AddContextFn = (context: Record<string, unknown>) => void

export type EmitFn<TEvents extends EventSchemaMap = EventSchemaMap> = <
  K extends keyof TEvents
>(
  eventName: K,
  data: TEvents[K]
) => Promise<void>

export type VisionVariables<TEvents extends EventSchemaMap = EventSchemaMap> = {
  span: SpanFn
  addContext: AddContextFn
  emit: EmitFn<TEvents>
}
```

```typescript
// packages/server/src/vision-app.ts

type WithVisionVars<E extends Env> = E extends { Variables: infer V }
  ? { Variables: V & VisionVariables }
  : { Variables: VisionVariables }

export class Vision<E extends Env = Env, S extends Schema = {}, BasePath extends string = '/'>
  extends Hono<WithVisionVars<E>, S, BasePath>
```

Replace all `(c as any).span = ...` with `c.set('span', ...)`:

```typescript
// vision-app.ts — installVisionMiddleware()
c.set('span', createSpanFn(tracer, trace, rootSpan, this.visionCore))
c.set('addContext', createAddContextFn(this.visionCore, trace))

// service.ts — build() finalHandler
c.set('emit', async (eventName, data) => this.eventBus.emit(String(eventName), data))
```

### Files to change
- `packages/server/src/types.ts` — add `VisionVariables`, `SpanFn`, `AddContextFn`, `EmitFn`
- `packages/server/src/vision-app.ts:377-408` — replace `(c as any)` with `c.set()`
- `packages/server/src/service.ts:535-590` — replace `(c as any)` with `c.set()`

### Impact
- Zero breaking changes to public API
- Handlers using `c.span()` get full autocomplete + type errors
- `c.emit()` gets `TEvents` type constraint properly enforced

---

## Issue 2 — Eliminate the `.build(app)` Registration Gap

### Problem

`ServiceBuilder` accumulates endpoints in an internal `Map<string, any>` but has no reference
to the Hono app until `.build()` is called, which leads to `as any`:

**`packages/server/src/service.ts:123-137`**
```typescript
export class ServiceBuilder<...> {
  private endpoints: Map<string, any> = new Map()

  constructor(
    private name: string,
    private eventBus: EventBus,
    private visionCore?: VisionCore
    // ← no reference to Hono app!
  )
```

**`packages/server/src/vision-app.ts:541-555`**
```typescript
service<...>(name: Name) {
  const builder = new ServiceBuilder(name, this.eventBus, this.visionCore)
  // ← 'this' (Vision/Hono) is NOT passed to builder
  this.serviceBuilders.push(builder as unknown as ServiceBuilder<any, any, E>)
  return builder
}
```

**`packages/server/src/vision-app.ts:585`**
```typescript
builder.build(this as any, allServices)  // ← as any cast
```

### Solution

Pass `this` to `ServiceBuilder` at construction time:

```typescript
// service.ts — updated constructor
export class ServiceBuilder<...> {
  private honoApp: Hono

  constructor(
    private name: string,
    private eventBus: EventBus,
    honoApp: Hono,           // ← injected
    private visionCore?: VisionCore
  ) {
    this.honoApp = honoApp
  }
```

```typescript
// vision-app.ts — updated service()
service<...>(name: Name) {
  const builder = new ServiceBuilder(name, this.eventBus, this, this.visionCore)
  //                                                        ^^^^ Vision IS a Hono
  this.serviceBuilders.push(builder)
  return builder
}
```

`.build()` no longer needs an `app` argument:

```typescript
// service.ts
build(servicesAccumulator?: Array<{ name: string; routes: any[] }>) {
  const routes = this.collectRouteMetadata()
  if (servicesAccumulator) servicesAccumulator.push({ name: this.name, routes })
  this.endpoints.forEach((ep) => {
    this.honoApp.on([ep.method], ep.path, ...allMiddleware, this.buildHandler(ep))
  })
}

// buildAllServices() — no more as any
builder.build(allServices)
```

### Files to change
- `packages/server/src/service.ts:123-145` — add `honoApp` to constructor
- `packages/server/src/service.ts:443-652` — remove `app` param from `.build()`
- `packages/server/src/vision-app.ts:541-586` — pass `this` in `service()`, fix `buildAllServices()`
- `packages/server/src/router.ts:96` — update `buildAllServices?.()` call (no args)

---

## Issue 3 — Auto-generate `AppRouter` from Registered Services

### Problem

Every consumer must manually maintain `AppRouter`:

**`examples/vision/src/index.ts:343-346`**
```typescript
// Manually written — silently drifts if service is added/renamed
export type AppRouter = {
  users: InferServiceEndpoints<typeof userService>
  orders: InferServiceEndpoints<typeof orderService>
}
```

### Solution

**Option A — helper function (lower risk, start here):**

```typescript
// packages/server/src/types.ts
export type InferAppRouter<
  TServices extends Record<string, ServiceBuilder<any, any, any>>
> = {
  [K in keyof TServices]: InferServiceEndpoints<TServices[K]>
}

// Usage — no manual typing:
const _services = { users: userService, orders: orderService }
export type AppRouter = InferAppRouter<typeof _services>
```

**Option B — Vision generic (more powerful, higher risk):**

```typescript
// Add TServices generic to Vision class
export class Vision<
  E extends Env = Env,
  S extends Schema = {},
  BasePath extends string = '/',
  TServices extends Record<string, ServiceBuilder<any,any,any>> = {}
> extends Hono<WithVisionVars<E>, S, BasePath> {

  get router(): InferAppRouter<TServices> { return null as any }
}

// Usage:
export type AppRouter = typeof app.router  // always in sync
```

### Files to change
- `packages/server/src/types.ts` — add `InferAppRouter<TServices>`
- `packages/server/src/vision-app.ts` — optionally add `TServices` generic + `router` getter
- `packages/server/src/index.ts` — export `InferAppRouter`
- `examples/vision/src/index.ts:343-346` — update to use new type helper

---

## Issue 4 — Composition over Inheritance

### Problem

`class Vision extends Hono<E, S, BasePath>` (vision-app.ts:179-183):
1. Carries 3 Hono generics even though Vision only needs `E`
2. Adding `TServices` (Issue 3) → 4 generics on an inherited class — unreadable
3. Hono breaking changes automatically break Vision
4. `build(this as any)` exists because TypeScript can't reconcile `Vision<E,S,B>` with `Hono<E>`

### Solution — Phased approach

**Phase A (now, no breaking changes):**
- Complete Issues 1 & 2 — they eliminate all `as any` symptoms
- Add `get hono(): Hono<WithVisionVars<E>>` bridge getter for internal use

**Phase B (next major version):**

```typescript
export class Vision<E extends Env = Env, TServices extends Record<string, any> = {}> {
  readonly app: Hono<WithVisionVars<E>>   // composition

  constructor(config?: VisionConfig) {
    this.app = new Hono<WithVisionVars<E>>()
    this.visionCore = new VisionCore(config?.vision ?? {})
    this.eventBus = new EventBus(config?.queue ?? {})
    this.installVisionMiddleware()
  }

  // Delegate only what consumers actually use
  use(...args: Parameters<Hono<WithVisionVars<E>>['use']>) { return this.app.use(...args) }
  route(path: string, sub: Hono<any>) { return this.app.route(path, sub) }
  readonly fetch = (...args: Parameters<Hono['fetch']>) => this.app.fetch(...args)
}
```

For file-based routing: `app.route('/api', vision.app)` instead of `app.route('/api', vision)`.

### Files to change
- Phase A: only `vision-app.ts` (add bridge getter)
- Phase B: `vision-app.ts` full rewrite, `router.ts`, all examples

---

## Implementation Order

| # | Issue | Why this order |
|---|-------|----------------|
| 1 | **Issue 2** — pass `this` to ServiceBuilder, fix `.build()` | Prerequisite: removes `as any` that blocks Issue 1 |
| 2 | **Issue 1** — Hono Variables | Clean, isolated, highest DX return |
| 3 | **Issue 3** — `InferAppRouter` helper (Option A) | Depends on clean service tracking |
| 4 | **Issue 4 Phase A** — bridge getter | Trivial, unblocks full composition later |
| 5 | **Issue 3 Option B + Issue 4 Phase B** | Separate PR, next major version |

---

## Testing Checklist

- [ ] All tests in `packages/server/src/__tests__/` pass unchanged
- [ ] `examples/vision` builds and runs with new types
- [ ] `c.span()`, `c.addContext()`, `c.emit()` are fully typed in handlers (no `as any` needed by consumer)
- [ ] Removing a service causes TypeScript error in `AppRouter` usage (auto-sync works)
- [ ] File-based routing via `loadSubApps()` still works
- [ ] Dev-mode EventBus still dispatches synchronously
- [ ] `createVisionClient<AppRouter>()` still resolves correct input/output types

---

## Quick File Reference

| File | Lines | Topic |
|------|-------|-------|
| `packages/server/src/vision-app.ts` | 179–183 | `Vision extends Hono` declaration |
| `packages/server/src/vision-app.ts` | 377–408 | `(c as any).span/.addContext` injection |
| `packages/server/src/vision-app.ts` | 541–555 | `service()` — builder created without `this` |
| `packages/server/src/vision-app.ts` | 580–586 | `buildAllServices()` → `builder.build(this as any)` |
| `packages/server/src/service.ts` | 123–145 | `ServiceBuilder` constructor (missing `honoApp`) |
| `packages/server/src/service.ts` | 235–288 | `.endpoint()` stores to Map, no immediate registration |
| `packages/server/src/service.ts` | 443–652 | `.build(app)` — bulk registration + template generation |
| `packages/server/src/service.ts` | 535–590 | `(c as any).addContext/.span/.emit` in finalHandler |
| `packages/server/src/types.ts` | 89–113 | `InferServiceEndpoints<T>` phantom type |
| `packages/server/src/router.ts` | 16–118 | `loadSubApps()` + `buildAllServices?.()` |
| `examples/vision/src/index.ts` | 343–346 | Manual `AppRouter` definition |
| `examples/vision/src/client-example.ts` | 14–140 | Client consumption of `AppRouter` |
