import { Elysia } from 'elysia'
import { VisionCore, runInTraceContext, generateTemplate } from '@getvision/core'
import type { RouteMetadata } from '@getvision/core'
import { AsyncLocalStorage } from 'async_hooks'
import { existsSync } from 'fs'
import { spawn, spawnSync, type ChildProcess } from 'child_process'
import type { z } from 'zod'
import type { QueueEventsOptions, QueueOptions, WorkerOptions } from 'bullmq'
import { EventBus } from './event-bus'
import { eventRegistry } from './event-registry'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * ALS context set during HTTP request processing.
 * Use `getVisionContext()` to retrieve from anywhere in request scope.
 */
export interface VisionALSContext {
  vision: VisionCore
  traceId: string
  rootSpanId: string
}

/**
 * Members injected into every Elysia handler context by the Vision derive.
 */
export interface VisionDerived {
  /** Start a child span under the current HTTP trace. */
  span: <T>(
    name: string,
    attributes?: Record<string, unknown>,
    fn?: () => T
  ) => T
  /** Attach arbitrary metadata to the current trace ("wide event"). */
  addContext: (context: Record<string, unknown>) => void
  /** Emit a registered pub/sub event (type-checked by the event bus). */
  emit: (eventName: string, data: Record<string, unknown>) => Promise<void>
  /** Current trace id (useful for cross-service correlation). */
  traceId: string
}

/**
 * Configuration for a single pub/sub event subscription.
 */
export interface EventConfig<T extends Record<string, unknown> = Record<string, unknown>> {
  schema: z.ZodSchema<T>
  description?: string
  icon?: string
  tags?: string[]
  /** Max concurrent jobs for this handler (BullMQ worker concurrency). */
  concurrency?: number
  handler: (event: T) => Promise<void> | void
}

/** Map of event name → config. Used by `onEvents()` and `defineEvents()`. */
export type EventMap = Record<string, EventConfig<any>>

/** Extract the payload type from an `EventConfig`. */
export type EventPayload<C> = C extends EventConfig<infer T> ? T : never

/**
 * Strongly-typed `emit` signature derived from an `EventMap`. Restricts the
 * `eventName` argument to declared keys and the `data` argument to the payload
 * inferred from the corresponding schema.
 */
export type TypedEmit<M extends EventMap> = <K extends keyof M & string>(
  eventName: K,
  data: EventPayload<M[K]>
) => Promise<void>

/**
 * Configuration for a scheduled cron job.
 */
export interface CronConfig {
  /** Cron expression (e.g. `'0 0 * * *'` for daily midnight). */
  schedule: string
  description?: string
  icon?: string
  tags?: string[]
  handler: (context: { jobId?: string; timestamp: number }) => Promise<void> | void
}

/** Map of cron name → config. Used by `defineCrons()`. */
export type CronMap = Record<string, CronConfig>

/**
 * Rate limiting options.
 */
export interface RateLimitOptions {
  /** Max requests allowed per window. */
  requests: number
  /**
   * Window duration. Either a string like `'15m'`, `'1h'`, `'30s'`, `'2d'`,
   * a numeric milliseconds value, or a pre-parsed number.
   */
  window: string | number
  /**
   * Custom store (e.g. Redis) — must implement `increment()`.
   * Defaults to in-memory map (per-process, not shared across instances).
   */
  store?: RateLimitStore
  /**
   * Compute the rate-limit key from the request context. Default combines
   * client IP (from `x-forwarded-for` / `x-real-ip` etc.) with method + path.
   */
  keyBy?: (ctx: RateLimitContext) => string
  /** Optional custom error message returned in the 429 body. */
  message?: string
}

/**
 * Minimal context shape required by rate limiter.
 *
 * Kept structurally compatible with Elysia's handler context so this helper
 * can be dropped into `beforeHandle` without casts. The `headers` value type
 * matches Elysia's `HTTPHeaders` (which allows `string | number`).
 */
export interface RateLimitContext {
  request: Request
  set: {
    status?: number | string
    headers: Record<string, string | number>
  }
}

export interface RateLimitEntry {
  count: number
  resetAt: number
}

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<RateLimitEntry> | RateLimitEntry
  reset?(key: string): Promise<void> | void
}

/**
 * Vision server configuration.
 */
export interface VisionConfig {
  service: {
    name: string
    version?: string
    description?: string
    integrations?: Record<string, string>
    drizzle?: {
      autoStart?: boolean
      port?: number
    }
  }
  vision?: {
    enabled?: boolean
    port?: number
    maxTraces?: number
    maxLogs?: number
    logging?: boolean
    apiUrl?: string
  }
  pubsub?: {
    redis?: {
      host?: string
      port?: number
      password?: string
      keepAlive?: number
      maxRetriesPerRequest?: number | null
      enableReadyCheck?: boolean
      connectTimeout?: number
      enableOfflineQueue?: boolean
    }
    devMode?: boolean
    eventBus?: EventBus
    workerConcurrency?: number
    queue?: Omit<QueueOptions, 'connection'>
    worker?: Omit<WorkerOptions, 'connection'>
    queueEvents?: Omit<QueueEventsOptions, 'connection'>
  }
}

// ---------------------------------------------------------------------------
// ALS
// ---------------------------------------------------------------------------

const visionContext = new AsyncLocalStorage<VisionALSContext>()

/** Retrieve the Vision context within the current async scope (if any). */
export function getVisionContext(): VisionALSContext | undefined {
  return visionContext.getStore()
}

// ---------------------------------------------------------------------------
// Global instance state (hot-reload cleanup)
// ---------------------------------------------------------------------------

const GLOBAL_VISION_KEY = '__vision_instance_state'
interface VisionGlobalState {
  instance: VisionAppHandle | null
  drizzleProcess: ChildProcess | null
}
if (!(globalThis as Record<string, unknown>)[GLOBAL_VISION_KEY]) {
  (globalThis as Record<string, unknown>)[GLOBAL_VISION_KEY] = {
    instance: null,
    drizzleProcess: null,
  }
}
function getGlobalState(): VisionGlobalState {
  return (globalThis as unknown as Record<string, VisionGlobalState>)[GLOBAL_VISION_KEY]
}

interface VisionAppHandle {
  eventBus: EventBus
  visionCore: VisionCore | null
  cleanup: () => Promise<void>
  /** Set once `ready()` finishes registering services/routes/events. */
  initialized: boolean
  /** Back-reference to the Elysia instance for route introspection. */
  app: unknown
  /** Memoized promise returned by `ready()`. */
  readyPromise?: Promise<void>
  /** Config snapshot for `ready()` to consume lazily. */
  config: VisionConfig
}

// ---------------------------------------------------------------------------
// Pending event/cron registrations — populated by `defineEvents`/`defineCrons`
// at module-evaluation time, drained by `ready()` against the app's EventBus.
//
// Kept on `globalThis` so Turbopack/HMR reloads don't create parallel queues
// that the fresh `ready()` would miss. Each entry carries a `registered` flag
// so a second `ready()` (e.g. after HMR) doesn't re-register the same event.
// ---------------------------------------------------------------------------

interface PendingEventReg {
  name: string
  cfg: EventConfig<any>
  registered: boolean
}
interface PendingCronReg {
  name: string
  cfg: CronConfig
  registered: boolean
}
interface PendingDefines {
  events: PendingEventReg[]
  crons: PendingCronReg[]
}
const PENDING_DEFINES_KEY = '__vision_pending_defines'
const globalForPending = globalThis as Record<string, unknown>
if (!globalForPending[PENDING_DEFINES_KEY]) {
  globalForPending[PENDING_DEFINES_KEY] = { events: [], crons: [] }
}
function getPendingDefines(): PendingDefines {
  return globalForPending[PENDING_DEFINES_KEY] as PendingDefines
}

// ---------------------------------------------------------------------------
// createVision() factory
// ---------------------------------------------------------------------------

/**
 * Create a Vision app — an Elysia instance wired with observability, pub/sub,
 * validation, and the Vision Dashboard bridge.
 *
 * The return value is a **plain Elysia** (not a subclass). This is intentional
 * — it keeps the full generic type chain working through every `.get/.post/
 * .use(...)`, so `treaty<typeof app>` on the client sees every route.
 *
 * @example
 * ```ts
 * import { createVision } from '@getvision/server'
 * import { usersModule } from './modules/users'
 *
 * const app = createVision({
 *   service: { name: 'My API', version: '1.0.0' },
 *   vision: { enabled: true, port: 9500 },
 *   pubsub: { devMode: true },
 * }).use(usersModule)
 *
 * export type App = typeof app
 * app.listen(3000)
 * ```
 */
export function createVision(config: VisionConfig) {
  const visionConfig: VisionConfig = {
    service: {
      ...config.service,
      name: config.service?.name ?? 'Vision App',
    },
    vision: { enabled: true, port: 9500, logging: true, ...(config.vision || {}) },
    pubsub: { ...(config.pubsub || {}) },
  }

  // Build the core but defer network I/O (WS port binding) until `ready()`.
  // This keeps `createVision()` side-effect-free so importing the app module
  // in a test or serverless cold-start doesn't spawn listeners.
  const visionCore = buildVisionCore(visionConfig)

  // Share EventBus across module reloads (Turbopack/HMR) — new BullMQ workers
  // on every reload would duplicate event handlers and chew Redis connections.
  const ebKey = `__vision_eventbus_${visionConfig.vision?.port ?? 9500}`
  const gBus = globalThis as Record<string, unknown>
  const existingBus = gBus[ebKey] as EventBus | undefined
  const eventBus =
    visionConfig.pubsub?.eventBus ||
    existingBus ||
    new EventBus({
      redis: visionConfig.pubsub?.redis,
      devMode: visionConfig.pubsub?.devMode,
      workerConcurrency: visionConfig.pubsub?.workerConcurrency,
      queue: visionConfig.pubsub?.queue,
      worker: visionConfig.pubsub?.worker,
      queueEvents: visionConfig.pubsub?.queueEvents,
    })
  if (!existingBus && !visionConfig.pubsub?.eventBus) {
    gBus[ebKey] = eventBus
  }

  if (visionCore) registerEventJsonRpcMethods(visionCore)

  const logging = visionConfig.vision?.logging !== false

  // Shared mutable handle — populated fully after the Elysia chain is built.
  const handle: VisionAppHandle = {
    eventBus,
    visionCore,
    initialized: false,
    config: visionConfig,
    app: undefined,
    cleanup: async () => {
      try {
        stopDrizzleStudio({ log: false })
      } catch {
        /* ignore */
      }
      try {
        await eventBus.close()
      } catch {
        /* ignore */
      }
    },
  }

  const noopSpan: VisionDerived['span'] = <T>(
    _n: string,
    _a?: Record<string, unknown>,
    fn?: () => T
  ): T => (fn ? fn() : (undefined as unknown as T))

  const dashboardOrigin = `http://localhost:${visionConfig.vision?.port ?? 9500}`

  const app = new Elysia()
    .decorate('visionCore', visionCore as VisionCore | null)
    .decorate('eventBus', eventBus)
    // Auto-allow the Vision Dashboard origin without forcing users to wire
    // CORS by hand. Dashboard → user API is the only cross-origin flow Vision
    // creates on its own; any other origin is left to the user's setup.
    .onRequest(({ request, set }) => {
      const origin = request.headers.get('origin')
      if (origin !== dashboardOrigin) return

      set.headers['access-control-allow-origin'] = origin
      set.headers['access-control-allow-credentials'] = 'true'
      set.headers['access-control-allow-headers'] = '*'
      set.headers['access-control-allow-methods'] =
        'GET,POST,PUT,PATCH,DELETE,OPTIONS'

      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'access-control-allow-origin': origin,
            'access-control-allow-credentials': 'true',
            'access-control-allow-headers': '*',
            'access-control-allow-methods':
              'GET,POST,PUT,PATCH,DELETE,OPTIONS',
          },
        })
      }
    })
    .derive({ as: 'global' }, async ({ request, store }) => {
      if (!visionCore) {
        return {
          span: noopSpan,
          addContext: (_ctx: Record<string, unknown>) => {},
          emit: (eventName: string, data: Record<string, unknown>) =>
            eventBus.emit(eventName, data),
          traceId: '',
        }
      }

      const url = new URL(request.url)
      const trace = visionCore.createTrace(request.method, url.pathname)
      const tracer = visionCore.getTracer()
      const rootSpan = tracer.startSpan('http.request', trace.id)
      const startTime = Date.now()

      tracer.setAttribute(rootSpan.id, 'http.method', request.method)
      tracer.setAttribute(rootSpan.id, 'http.path', url.pathname)
      tracer.setAttribute(rootSpan.id, 'http.url', request.url)
      if (url.search) tracer.setAttribute(rootSpan.id, 'http.query', url.search)

      // Capture request headers + query here. Body is captured later in
      // onBeforeHandle (Elysia hasn't parsed it yet at derive-time).
      const headersMap: Record<string, string> = {}
      request.headers.forEach((v, k) => {
        headersMap[k] = v
      })
      const queryMap: Record<string, string> = {}
      url.searchParams.forEach((v, k) => {
        queryMap[k] = v
      })

      const sessionId = request.headers.get('x-vision-session') ?? undefined
      if (sessionId) {
        tracer.setAttribute(rootSpan.id, 'session.id', sessionId)
        trace.metadata = { ...(trace.metadata || {}), sessionId }
      }

      const requestMeta: Record<string, unknown> = {
        method: request.method,
        url: url.pathname + (url.search || ''),
        headers: headersMap,
        query: Object.keys(queryMap).length ? queryMap : undefined,
      }
      tracer.setAttribute(rootSpan.id, 'http.request', requestMeta)
      trace.metadata = { ...(trace.metadata || {}), request: requestMeta }

      const s = store as Record<string, unknown>
      s.__visionTraceId = trace.id
      s.__visionRootSpanId = rootSpan.id
      s.__visionStart = startTime

      if (logging) {
        const parts = [`method=${request.method}`, `path=${url.pathname}`]
        if (sessionId) parts.push(`sessionId=${sessionId}`)
        parts.push(`traceId=${trace.id}`)
        console.info(`INF starting request ${parts.join(' ')}`)
      }

      const span: VisionDerived['span'] = (name, attributes = {}, fn) => {
        const childSpan = tracer.startSpan(name, trace.id, rootSpan.id)
        for (const [k, v] of Object.entries(attributes)) {
          tracer.setAttribute(childSpan.id, k, v)
        }
        try {
          const result = fn
            ? fn()
            : (undefined as ReturnType<NonNullable<typeof fn>>)
          const completed = tracer.endSpan(childSpan.id)
          if (completed) visionCore.getTraceStore().addSpan(trace.id, completed)
          return result
        } catch (err) {
          tracer.setAttribute(childSpan.id, 'error', true)
          tracer.setAttribute(
            childSpan.id,
            'error.message',
            err instanceof Error ? err.message : String(err)
          )
          const completed = tracer.endSpan(childSpan.id)
          if (completed) visionCore.getTraceStore().addSpan(trace.id, completed)
          throw err
        }
      }

      const addContext: VisionDerived['addContext'] = (ctx) => {
        const visionTrace = visionCore.getTraceStore().getTrace(trace.id)
        if (visionTrace) {
          visionTrace.metadata = { ...(visionTrace.metadata || {}), ...ctx }
        }
      }

      const emit: VisionDerived['emit'] = (eventName, data) =>
        eventBus.emit(eventName, data)

      return {
        span,
        addContext,
        emit,
        traceId: trace.id,
      }
    })
    .onBeforeHandle({ as: 'global' }, ({ store, body, request }) => {
      if (!visionCore) return
      const s = store as Record<string, unknown>
      const traceId = s.__visionTraceId as string | undefined
      const rootSpanId = s.__visionRootSpanId as string | undefined
      if (!traceId || !rootSpanId) return

      visionContext.enterWith({
        vision: visionCore,
        traceId,
        rootSpanId,
      })
      runInTraceContext(traceId, () => {
        /* sets the core's ALS for console interceptors */
      })

      // Merge the already-parsed body into trace.metadata.request.body.
      const shouldHaveBody = ['POST', 'PUT', 'PATCH'].includes(request.method)
      if (shouldHaveBody && body !== undefined) {
        const trace = visionCore.getTraceStore().getTrace(traceId)
        if (trace?.metadata) {
          const req = (trace.metadata as { request?: Record<string, unknown> })
            .request
          if (req) req.body = body
        }
        visionCore.getTracer().setAttribute(rootSpanId, 'http.request.body', body)
      }
    })
    .onAfterHandle({ as: 'global' }, async ({ store, set, response }) => {
      // Capture response body + headers before network write.
      if (!visionCore) return
      const s = store as Record<string, unknown>
      const traceId = s.__visionTraceId as string | undefined
      const rootSpanId = s.__visionRootSpanId as string | undefined
      if (!traceId || !rootSpanId) return

      const tracer = visionCore.getTracer()
      const isRawResponse = response instanceof Response
      // Raw Response carries its own status/headers and bypasses `set.*` — so
      // prefer values off the Response instance when present (e.g. short-circuit
      // from `beforeHandle` returning `new Response(..., { status: 429 })`).
      const status = isRawResponse
        ? response.status
        : typeof set.status === 'number'
          ? set.status
          : 200

      const resHeaders: Record<string, string> = {}
      if (set.headers) {
        for (const [k, v] of Object.entries(set.headers)) {
          if (typeof v === 'string') resHeaders[k] = v
        }
      }
      if (isRawResponse) {
        response.headers.forEach((v, k) => {
          resHeaders[k.toLowerCase()] = v
        })
      }

      let responseBody: unknown = response
      if (isRawResponse) {
        // Clone before reading so we don't consume the stream that the runtime
        // still needs to flush to the client. Try JSON first, fall back to text.
        try {
          const text = await response.clone().text()
          if (text.length > 65536) {
            responseBody = '<truncated>'
          } else if (text.length === 0) {
            responseBody = undefined
          } else {
            const ct = resHeaders['content-type'] ?? ''
            if (ct.includes('application/json')) {
              try {
                responseBody = JSON.parse(text)
              } catch {
                responseBody = text
              }
            } else {
              responseBody = text
            }
          }
        } catch {
          responseBody = undefined
        }
      } else {
        try {
          const asJson = JSON.stringify(response)
          if (asJson && asJson.length > 65536) responseBody = '<truncated>'
        } catch {
          responseBody = undefined
        }
      }

      const responseMeta = {
        status,
        headers: Object.keys(resHeaders).length ? resHeaders : undefined,
        body: responseBody,
      }
      tracer.setAttribute(rootSpanId, 'http.response', responseMeta)

      const trace = visionCore.getTraceStore().getTrace(traceId)
      if (trace) {
        trace.metadata = { ...(trace.metadata || {}), response: responseMeta }
      }
    })
    .onAfterResponse({ as: 'global' }, ({ store, set, response }) => {
      if (!visionCore) return
      const s = store as Record<string, unknown>
      const traceId = s.__visionTraceId as string | undefined
      const rootSpanId = s.__visionRootSpanId as string | undefined
      const startTime = s.__visionStart as number | undefined
      if (!traceId || !rootSpanId) return

      const tracer = visionCore.getTracer()
      const status =
        response instanceof Response
          ? response.status
          : typeof set.status === 'number'
            ? set.status
            : 200
      tracer.setAttribute(rootSpanId, 'http.status_code', status)

      const completed = tracer.endSpan(rootSpanId)
      if (completed) visionCore.getTraceStore().addSpan(traceId, completed)

      const duration = startTime ? Date.now() - startTime : 0
      visionCore.completeTrace(traceId, status, duration)

      set.headers['x-vision-trace-id'] = traceId

      if (logging) {
        console.info(
          `INF request completed code=${status} duration=${duration}ms traceId=${traceId}`
        )
      }
    })
    .onError({ as: 'global' }, ({ error, store }) => {
      if (!visionCore) return
      const s = store as Record<string, unknown>
      const traceId = s.__visionTraceId as string | undefined
      const rootSpanId = s.__visionRootSpanId as string | undefined
      if (!traceId || !rootSpanId) return

      const tracer = visionCore.getTracer()
      tracer.addEvent(rootSpanId, 'error', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      tracer.setAttribute(rootSpanId, 'error', true)
    })
    .onRequest(() => {
      // Lazy refresh: `doReady` is idempotent and memoized on `handle.readyPromise`.
      // On a ready handle this is effectively a no-op (awaits the cached promise).
      // On a fresh handle produced by HMR, this registers routes / events / services
      // against the globally-cached VisionCore exactly once — keeping Dashboard
      // metadata in sync with the live handlers on the very next request, without
      // leaking `ready()` into user route files.
      //
      // This does NOT replace explicit initialization paths:
      //  - `.listen()` callers get deterministic boot via `onStart` → `doReady`.
      //  - `.handle()` callers (Next.js instrumentation) get eager boot via the
      //    top-level `ready(app)` helper at server-boot time.
      return doReady(handle)
    })
    .onStart(async () => {
      // `.listen()` path — await full initialization (including Dashboard
      // port binding) before the HTTP server accepts requests. Elysia awaits
      // `onStart` handlers, so this is the one lifecycle hook that gives us
      // deterministic "vision is ready" semantics without a user `await`.
      await doReady(handle)
      await installProcessHandlers(handle)
    })

  handle.app = app

  /**
   * Public `ready()` — async, idempotent. Covers the `.handle(req)` path
   * (Next.js, WinterCG, serverless) where Elysia's `onStart` never fires.
   *
   * Attached via `Object.assign` to avoid polluting the Elysia handler
   * context. This does NOT survive the `.use(...)` type chain: TypeScript
   * sees the augmented type only on the immediate `createVision()` return.
   * Users composing with `.use()` should call the top-level `ready(app)`
   * helper exported from `@getvision/server`, which types cleanly.
   */
  const appWithReady = Object.assign(app, {
    ready: (): Promise<void> => doReady(handle),
  })

  return appWithReady
}

/**
 * Idempotent bootstrap for a Vision app. Drives three things:
 *
 * 1. Binds the Dashboard port via `core.start()` (TCP-probes first — silently
 *    skips if another process already owns the port).
 * 2. Registers the composed Elysia routes/services with the Dashboard, plus
 *    any events/crons queued by `defineEvents` / `defineCrons`.
 * 3. Autodetects Drizzle and optionally starts Drizzle Studio.
 *
 * Memoized on `handle.readyPromise` — concurrent callers share the same
 * promise, and second+ calls after resolution are cheap no-ops. Called from
 * `onStart` (listen path) and from the public `app.ready()` (handle path).
 */
function doReady(handle: VisionAppHandle): Promise<void> {
  if (handle.readyPromise) return handle.readyPromise
  handle.readyPromise = (async () => {
    const visionCore = handle.visionCore
    const config = handle.config

    // Bind WS + HTTP port first so the Dashboard sees `app.started` events
    // (fired from `setAppStatus`) on a live socket rather than dropping them
    // before any client can connect.
    if (visionCore) {
      await visionCore.start()
    }

    // Drain the pending event/cron queues populated at module-evaluation time
    // by `defineEvents` / `defineCrons`. We register against THIS app's bus;
    // the `registered` flag prevents duplicate handlers across HMR or a
    // second `ready()` call.
    const pending = getPendingDefines()
    for (const entry of pending.events) {
      if (entry.registered) continue
      entry.registered = true
      registerEventHandler(handle.eventBus, entry.name, entry.cfg)
    }
    for (const entry of pending.crons) {
      if (entry.registered) continue
      entry.registered = true
      void scheduleCron(handle.eventBus, entry.name, entry.cfg)
    }

    if (!visionCore) {
      handle.initialized = true
      return
    }

    // Dashboard: register routes + services (mirrors what the user composed
    // via `.use(module)` calls).
    const { services, routes } = extractRouteMetadata(handle.app)
    if (routes.length > 0) {
      visionCore.registerServices(services)
      visionCore.registerRoutes(routes)
      console.log(
        `✅ Registered ${services.length} services (${routes.length} routes) with Vision Dashboard`
      )
    }

    // Mark "running" explicitly — buildVisionCore intentionally does not, so
    // the Dashboard gets a single `app.started` broadcast once initialization
    // fully completes rather than one at import time.
    const cleanIntegrations = Object.fromEntries(
      Object.entries(config.service.integrations || {}).filter(
        ([, v]) => v !== undefined
      )
    )
    visionCore.setAppStatus({
      name: config.service.name,
      version: config.service.version ?? '0.0.0',
      description: config.service.description,
      running: true,
      pid: process.pid,
      metadata: {
        framework: 'vision-server',
        integrations:
          Object.keys(cleanIntegrations).length > 0 ? cleanIntegrations : undefined,
      },
    })

    // Drizzle Studio autodetect + optional autostart.
    const drizzleInfo = detectDrizzle()
    if (drizzleInfo.detected) {
      console.log(`🗄️  Drizzle detected (${drizzleInfo.configPath})`)
      let drizzleStudioUrl: string | undefined = 'https://local.drizzle.studio'
      if (config.service.drizzle?.autoStart) {
        const drizzlePort = config.service.drizzle.port || 4983
        const started = startDrizzleStudio(drizzlePort)
        if (!started) drizzleStudioUrl = undefined
      } else {
        console.log(
          '💡 Tip: Enable Drizzle Studio auto-start with drizzle: { autoStart: true }'
        )
      }
      const currentStatus =
        (visionCore as unknown as { appStatus?: Record<string, unknown> }).appStatus || {}
      const currentMeta = (currentStatus.metadata as Record<string, unknown>) || {}
      visionCore.setAppStatus({
        metadata: {
          ...currentMeta,
          drizzle: {
            detected: true,
            configPath: drizzleInfo.configPath,
            studioUrl: drizzleStudioUrl,
            autoStarted: config.service.drizzle?.autoStart || false,
          },
        },
      })
    }

    handle.initialized = true
  })()
  return handle.readyPromise
}

/**
 * Top-level `ready(app)` helper. Preferred over `app.ready()` because it
 * survives the `.use()` chain (TypeScript forgets Object.assign'd properties
 * through Elysia's fluent generics).
 *
 * @example
 * ```ts
 * import { createVision, ready } from '@getvision/server'
 *
 * const app = createVision({ ... }).use(usersModule).use(ordersModule)
 * await ready(app)   // registers services/events/crons with Dashboard
 * export { app }
 * ```
 */
export async function ready(app: unknown): Promise<void> {
  const fn = (app as { ready?: () => Promise<void> }).ready
  if (typeof fn !== 'function') {
    throw new Error(
      '[vision] `ready(app)` called on an object that is not a Vision app. ' +
        'Make sure `app` was built with `createVision(...)`.'
    )
  }
  await fn()
}

/**
 * Register process-level handlers (signals, Bun hot-reload).
 *
 * Only called from `onStart` — makes no sense when Vision runs under a host
 * process (Next.js etc.) that owns those hooks.
 */
async function installProcessHandlers(handle: VisionAppHandle): Promise<void> {
  const state = getGlobalState()
  if (state.instance && state.instance !== handle) {
    await state.instance.cleanup()
  }
  state.instance = handle

  const signalHandler = async () => {
    const s = getGlobalState()
    if (s.instance) await s.instance.cleanup()
    try {
      process.exit(0)
    } catch {
      /* ignore */
    }
  }
  process.removeListener('SIGINT', signalHandler)
  process.removeListener('SIGTERM', signalHandler)
  try {
    process.removeListener('SIGQUIT', signalHandler)
  } catch {
    /* ignore */
  }
  process.on('SIGINT', signalHandler)
  process.on('SIGTERM', signalHandler)
  try {
    process.on('SIGQUIT', signalHandler)
  } catch {
    /* ignore */
  }

  try {
    const hot = (import.meta as unknown as { hot?: { dispose?: (fn: () => void) => void } })
      .hot
    if (hot && typeof hot.dispose === 'function') {
      hot.dispose(async () => {
        console.log('♻️ Hot reload: reloading...')
        process.off('SIGINT', signalHandler)
        process.off('SIGTERM', signalHandler)
        try {
          process.off('SIGQUIT', signalHandler)
        } catch {
          /* ignore */
        }
        const s = getGlobalState()
        await handle.cleanup()
        if (s.instance === handle) s.instance = null
      })
    }
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// createModule() — Elysia plugin factory for Vision-aware sub-modules
// ---------------------------------------------------------------------------

/**
 * Create a Vision sub-module (Elysia plugin) with the Vision context types
 * already declared.
 *
 * Use this instead of plain `new Elysia({ prefix })` when writing modules whose
 * handlers call `c.span()`, `c.emit()`, `c.addContext()` — otherwise TypeScript
 * can't see those members.
 *
 * Runtime behaviour: `.decorate` only adds type placeholders. The **real**
 * implementations come from the root `createVision()` via `.derive({ as:
 * 'global' }, ...)` — which populates them on every request, regardless of
 * which module the matched route lives in.
 *
 * NB: don't use `.derive({ as: 'scoped' }, noops)` here — scoped derive runs
 * AFTER global derive and would overwrite the real values with noops.
 *
 * @example
 * ```ts
 * export const usersModule = createModule({ prefix: '/users' })
 *   .use(defineEvents({ 'user/created': { schema, handler } }))
 *   .get('/', ({ span }) => span('db.users.all', {}, () => [...]))
 *   .post('/', ({ body, emit }) => emit('user/created', body))
 * ```
 */
export function createModule(opts?: { prefix?: string }) {
  const noopSpan = (<T,>(_n: string, _a?: Record<string, unknown>, fn?: () => T): T =>
    (fn ? fn() : (undefined as unknown as T))) as VisionDerived['span']
  
  return new Elysia({ prefix: opts?.prefix })
    .decorate('span', noopSpan)
    .decorate('addContext', (() => {}) as VisionDerived['addContext'])
    .decorate('traceId', '')
}

// ---------------------------------------------------------------------------
// Event subscription helpers
// ---------------------------------------------------------------------------

type HasEventBus = { eventBus: EventBus }

/**
 * Register a single pub/sub event handler.
 *
 * Standalone helper — call it anywhere, even after the Elysia chain mutates
 * the app's static type.
 */
export function onEvent<T extends Record<string, unknown>>(
  decorator: HasEventBus,
  eventName: string,
  config: EventConfig<T>
): void {
  registerEventHandler(decorator.eventBus, eventName, config)
}

/**
 * Batch-register many pub/sub event handlers in one call.
 *
 * Useful when many events live in the same module — avoids repeating
 * `onEvent(decorator, ...)` for each.
 */
export function onEvents(decorator: HasEventBus, events: EventMap): void {
  for (const [name, cfg] of Object.entries(events)) {
    registerEventHandler(decorator.eventBus, name, cfg)
  }
}

/**
 * Elysia plugin form — colocate events with the routes that emit them.
 *
 * Returns a plugin that, when `.use()`'d into a Vision app, registers each
 * handler against the root app's EventBus (looked up through the global
 * decorator chain at `onStart`).
 *
 * @example
 * ```ts
 * export const usersModule = createModule({ prefix: '/users' })
 *   .use(defineEvents({
 *     'user/created': {
 *       schema: z.object({ userId: z.string(), email: z.string() }),
 *       handler: async (event) => console.log('created', event),
 *     },
 *     'user/deleted': {
 *       schema: z.object({ userId: z.string() }),
 *       handler: async (event) => console.log('deleted', event),
 *     },
 *   }))
 *   .post('/', ({ body, emit }) => emit('user/created', { ... }))
 * ```
 */
export function defineEvents<const M extends EventMap>(events: M) {
  // Queue registrations at module-evaluation time. `ready()` drains the
  // queue against the app's EventBus. We used to hook `onStart` / `onRequest`
  // to discover the bus — but that coupled initialization to first-request
  // timing (the bug we're killing). HMR-safety: the queue itself is stashed
  // on `globalThis`, and each entry carries a `registered` flag so a second
  // `ready()` cycle doesn't double-register handlers from the same module.
  const pending = getPendingDefines()
  for (const [name, cfg] of Object.entries(events)) {
    // Dedup by name — on HMR the module re-evaluates and replaces `cfg` with
    // the fresh closure (which is what the user expects: new code should run
    // on next trigger). Registration itself is gated by the `ready()` loop.
    const existing = pending.events.find((e) => e.name === name)
    if (existing) {
      existing.cfg = cfg
      existing.registered = false
    } else {
      pending.events.push({ name, cfg, registered: false })
    }
  }
  // Decorate `emit` with a signature narrowed to the declared event map so
  // handlers downstream of `.use(defineEvents({...}))` get compile-time
  // checking of event names and payload shapes. Runtime is a placeholder:
  // the real `emit` is supplied per-request by `createVision`'s `.derive`
  // (which wires the EventBus). The type flows through Elysia's decorator
  // merging so `({ emit }) => emit('user/created', { ... })` is type-checked.
  const typedEmit: TypedEmit<M> = async () => {}
  return new Elysia().decorate('emit', typedEmit)
}

/**
 * Elysia plugin form — register cron jobs colocated with the module that owns
 * them. Each entry is scheduled via BullMQ repeatable jobs on `onStart`.
 *
 * @example
 * ```ts
 * export const maintenanceModule = createModule()
 *   .use(defineCrons({
 *     'daily-cleanup': {
 *       schedule: '0 0 * * *',
 *       description: 'Prune stale sessions',
 *       icon: '🧹',
 *       handler: async (ctx) => { ... },
 *     },
 *   }))
 * ```
 */
export function defineCrons(crons: CronMap) {
  // Queue-based registration — see `defineEvents` above for rationale.
  const pending = getPendingDefines()
  for (const [name, cfg] of Object.entries(crons)) {
    const existing = pending.crons.find((c) => c.name === name)
    if (existing) {
      existing.cfg = cfg
      existing.registered = false
    } else {
      pending.crons.push({ name, cfg, registered: false })
    }
  }
  return new Elysia()
}

async function scheduleCron(bus: EventBus, name: string, cfg: CronConfig): Promise<void> {
  eventRegistry.registerCron(
    name,
    cfg.schedule,
    async (ctx) => {
      await cfg.handler(ctx)
    },
    { description: cfg.description, icon: cfg.icon, tags: cfg.tags }
  )

  const queue = await bus.getQueueForCron(name)
  await queue.upsertJobScheduler(
    name,
    { pattern: cfg.schedule },
    { name, data: {}, opts: {} }
  )

  bus.registerCronHandler(name, async (ctx) => {
    await cfg.handler(ctx)
  })
}

/**
 * In-memory rate-limit store. Uses a lazily-swept `Map` keyed by client+route.
 *
 * Process-local — for multi-instance deployments, pass a Redis-backed
 * `RateLimitStore` implementation to `rateLimit({ store })`.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private data = new Map<string, RateLimitEntry>()

  increment(key: string, windowMs: number): RateLimitEntry {
    const now = Date.now()
    const existing = this.data.get(key)
    if (!existing || existing.resetAt <= now) {
      const entry: RateLimitEntry = { count: 1, resetAt: now + windowMs }
      this.data.set(key, entry)
      return entry
    }
    existing.count += 1
    return existing
  }

  reset(key: string): void {
    this.data.delete(key)
  }
}

const defaultMemoryStore = new MemoryRateLimitStore()

const WINDOW_UNITS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
}

function parseWindow(window: string | number): number {
  if (typeof window === 'number') return window
  const trimmed = window.trim()
  if (/^\d+$/.test(trimmed)) return Number(trimmed)
  const match = trimmed.match(/^(\d+)\s*([smhd])$/i)
  if (!match) throw new Error(`Invalid ratelimit window: ${window}`)
  return Number(match[1]) * WINDOW_UNITS[match[2].toLowerCase()]
}

function defaultRateLimitKey(ctx: RateLimitContext): string {
  const { request } = ctx
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('fly-client-ip') ||
    request.headers.get('x-client-ip') ||
    ''
  const ua = request.headers.get('user-agent') || 'unknown'
  const url = new URL(request.url)
  return `${ip || ua}:${request.method}:${url.pathname}`
}

/**
 * Rate-limit middleware factory — returns a `beforeHandle` function compatible
 * with Elysia's hook chain.
 *
 * Adds `ratelimit-limit`, `ratelimit-remaining`, `ratelimit-reset` headers to
 * every response (draft RFC 9239 / draft-ietf-httpapi-ratelimit-headers-06).
 *
 * @example
 * ```ts
 * // Per-route
 * module.post('/users', handler, {
 *   body: CreateUser,
 *   beforeHandle: [rateLimit({ requests: 10, window: '15m' })],
 * })
 *
 * // Per-module
 * module.onBeforeHandle(rateLimit({ requests: 100, window: '1m' }))
 *
 * // With Redis store
 * rateLimit({
 *   requests: 100,
 *   window: '1m',
 *   store: new RedisRateLimitStore(redisClient),
 * })
 * ```
 */
export function rateLimit(options: RateLimitOptions) {
  const windowMs = parseWindow(options.window)
  const store = options.store ?? defaultMemoryStore
  const keyBy = options.keyBy ?? defaultRateLimitKey
  const limit = options.requests
  const message = options.message ?? 'Too Many Requests'

  const hook = async (ctx: RateLimitContext) => {
    const key = keyBy(ctx)
    const entry = await store.increment(key, windowMs)
    const remaining = Math.max(0, limit - entry.count)
    const resetInSec = Math.max(0, Math.ceil((entry.resetAt - Date.now()) / 1000))

    ctx.set.headers['ratelimit-limit'] = String(limit)
    ctx.set.headers['ratelimit-remaining'] = String(remaining)
    ctx.set.headers['ratelimit-reset'] = String(resetInSec)

    if (entry.count > limit) {
      return new Response(
        JSON.stringify({ error: message, retryAfter: resetInSec }),
        {
          status: 429,
          headers: {
            'content-type': 'application/json',
            'retry-after': String(resetInSec),
            'ratelimit-limit': String(limit),
            'ratelimit-remaining': '0',
            'ratelimit-reset': String(resetInSec),
          },
        }
      )
    }
  }

  // Publicly typed as `Promise<void>` so the hook stays assignable to any
  // route's beforeHandle regardless of its declared response schema. At
  // runtime the hook still returns a Response on 429 — Elysia detects
  // `instanceof Response` and uses it as the short-circuit response without
  // running schema validation on it.
  return hook as unknown as (ctx: RateLimitContext) => Promise<void>
}

function registerEventHandler(
  bus: EventBus,
  eventName: string,
  config: EventConfig<any>
): void {
  const { schema, handler, description, icon, tags, concurrency } = config

  // HMR-safe: wipe any prior handler + worker registered under this name.
  // `ready()` calls us once per pending-queue entry, and on re-evaluation
  // the queue resets the `registered` flag, so without this clear we'd end
  // up with the stale closure AND the fresh one both firing per event.
  // Metadata (counts, description) is preserved by `clearEventHandlers`.
  eventRegistry.clearEventHandlers(eventName)
  bus.clearHandler(eventName)

  eventRegistry.registerEvent(
    eventName,
    schema,
    async (data) => {
      await handler(data)
    },
    { description, icon, tags }
  )

  bus.registerHandler(
    eventName,
    async (data) => {
      await handler(data)
    },
    { concurrency }
  )
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function buildVisionCore(config: VisionConfig): VisionCore | null {
  const enabled = config.vision?.enabled !== false
  if (!enabled) return null

  // Share VisionCore across module reloads (Turbopack/HMR) within a single
  // process. Without this, every HMR cycle allocates a fresh VisionCore that
  // races the previous instance for port 9500. Note: multi-PROCESS safety
  // (Next.js orchestrator + worker) is handled inside `server.start()` via
  // the TCP port probe — globalThis cannot cross process boundaries.
  const port = config.vision?.port ?? 9500
  const coreKey = `__vision_core_${port}`
  const g = globalThis as Record<string, unknown>
  let core = g[coreKey] as VisionCore | undefined
  if (!core) {
    core = new VisionCore({
      port,
      maxTraces: config.vision?.maxTraces ?? 1000,
      maxLogs: config.vision?.maxLogs ?? 10000,
      apiUrl: config.vision?.apiUrl,
      // Defer port binding until `ready()` — this is the whole point of
      // the refactor: no network I/O during module evaluation.
      autoStart: false,
    })
    g[coreKey] = core
  }

  // Intentionally no `setAppStatus({ running: true })` here — `doReady()`
  // publishes the full status once initialization actually completes.
  return core
}

function registerEventJsonRpcMethods(visionCore: VisionCore) {
  const server = visionCore.getServer()

  server.registerMethod('events/list', async () => {
    return eventRegistry.getAllEvents().map((event) => ({
      name: event.name,
      description: event.description,
      icon: event.icon,
      tags: event.tags,
      handlers: event.handlers.length,
      lastTriggered: event.lastTriggered,
      totalCount: event.totalCount,
      failedCount: event.failedCount,
    }))
  })

  server.registerMethod('cron/list', async () => {
    return eventRegistry.getAllCrons().map((cron) => ({
      name: cron.name,
      schedule: cron.schedule,
      description: cron.description,
      icon: cron.icon,
      tags: cron.tags,
      lastRun: cron.lastRun,
      nextRun: cron.nextRun,
      totalRuns: cron.totalRuns,
      failedRuns: cron.failedRuns,
    }))
  })
}

/**
 * Walk `app.routes` and build dashboard-compatible metadata.
 */
function extractRouteMetadata(app: unknown): {
  services: Array<{ name: string; routes: RouteMetadata[] }>
  routes: RouteMetadata[]
} {
  const raw = (app as { routes?: unknown[] }).routes
  if (!Array.isArray(raw)) return { services: [], routes: [] }

  const allRoutes: RouteMetadata[] = []

  for (const entry of raw as Array<{
    method: string
    path: string
    hooks?: {
      body?: unknown
      query?: unknown
      params?: unknown
      response?: unknown
    }
  }>) {
    if (!entry?.method || !entry?.path) continue
    // Normalize trailing slash (keep `/` itself). Elysia stores module
    // routes as e.g. `/users/` when `createModule({ prefix: '/users' })`
    // is composed with `.get('/')`. Leaving that trailing slash in the
    // Dashboard-facing path breaks the API Explorer under Next.js: the
    // host 308-redirects `/api/users/` → `/api/users` and browsers reject
    // redirects on CORS preflight with "Redirect is not allowed for a
    // preflight request". `strictPath: false` (Elysia default) matches
    // both `/users` and `/users/`, so dropping the slash is safe.
    const path =
      entry.path.length > 1 && entry.path.endsWith('/')
        ? entry.path.slice(0, -1)
        : entry.path
    const method = entry.method.toUpperCase()
    // Hide CORS preflight routes — the `@elysia/cors` plugin registers
    // `OPTIONS /*` on every mounted scope, which floods the Dashboard
    // endpoints list with duplicates that aren't user-authored routes.
    if (method === 'OPTIONS') continue
    const hooks = entry.hooks || {}

    let requestBody: RouteMetadata['requestBody']
    let queryParams: RouteMetadata['queryParams']
    let responseBody: RouteMetadata['responseBody']

    if (hooks.body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      requestBody = safeTemplate(hooks.body)
    }
    if (hooks.query) queryParams = safeTemplate(hooks.query)
    if (hooks.response) responseBody = safeTemplate(hooks.response)

    allRoutes.push({
      method,
      path,
      handler: inferServiceName(path),
      queryParams,
      requestBody,
      responseBody,
    })
  }

  // Group by first path segment.
  const grouped = new Map<string, RouteMetadata[]>()
  for (const r of allRoutes) {
    const segment = r.path.split('/').filter(Boolean)[0] ?? 'root'
    if (!grouped.has(segment)) grouped.set(segment, [])
    grouped.get(segment)!.push(r)
  }

  const services = Array.from(grouped.entries()).map(([name, routes]) => ({
    name: name === 'root' ? 'Root' : name.charAt(0).toUpperCase() + name.slice(1),
    routes,
  }))

  return { services, routes: allRoutes }
}

function inferServiceName(path: string): string {
  const seg = path.split('/').filter(Boolean)[0]
  if (!seg) return 'root'
  return seg.charAt(0).toUpperCase() + seg.slice(1)
}

function safeTemplate(schema: unknown): RouteMetadata['requestBody'] {
  try {
    return generateTemplate(schema as never) as RouteMetadata['requestBody']
  } catch {
    return undefined
  }
}

// ---------------------------------------------------------------------------
// Drizzle Studio autodetect / control
// ---------------------------------------------------------------------------

function detectDrizzle(): { detected: boolean; configPath?: string } {
  const possiblePaths = ['drizzle.config.ts', 'drizzle.config.js', 'drizzle.config.mjs']
  for (const path of possiblePaths) {
    if (existsSync(path)) return { detected: true, configPath: path }
  }
  return { detected: false }
}

function startDrizzleStudio(port: number): boolean {
  const state = getGlobalState()
  if (state.drizzleProcess) {
    console.log('⚠️  Drizzle Studio is already running')
    return false
  }

  // Already listening on this port? Skip spawning, report available.
  try {
    if (process.platform === 'win32') {
      const res = spawnSync(
        'powershell',
        [
          '-NoProfile',
          '-Command',
          `netstat -ano | Select-String -Pattern "LISTENING\\s+.*:${port}\\s"`,
        ],
        { encoding: 'utf-8' }
      )
      if ((res.stdout || '').trim().length > 0) {
        console.log(
          `⚠️  Drizzle Studio port ${port} already in use; assuming it is running. Skipping auto-start.`
        )
        return true
      }
    } else {
      const res = spawnSync('lsof', ['-i', `tcp:${port}`, '-sTCP:LISTEN'], {
        encoding: 'utf-8',
      })
      if ((res.stdout || '').trim().length > 0) {
        console.log(
          `⚠️  Drizzle Studio port ${port} already in use; assuming it is running. Skipping auto-start.`
        )
        return true
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const proc = spawn(
      'npx',
      ['drizzle-kit', 'studio', '--port', String(port), '--host', '0.0.0.0'],
      {
        stdio: 'inherit',
        detached: false,
        shell: process.platform === 'win32',
      }
    )

    state.drizzleProcess = proc
    proc.on('error', (error) => {
      console.error('❌ Failed to start Drizzle Studio:', error.message)
    })
    proc.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`❌ Drizzle Studio exited with code ${code}`)
      }
      const s = getGlobalState()
      if (s.drizzleProcess === proc) s.drizzleProcess = null
    })

    console.log(`✅ Drizzle Studio: https://local.drizzle.studio`)
    return true
  } catch (error) {
    console.error('❌ Failed to start Drizzle Studio:', error)
    return false
  }
}

function stopDrizzleStudio(options?: { log?: boolean }): boolean {
  const state = getGlobalState()
  if (state.drizzleProcess) {
    state.drizzleProcess.removeAllListeners()
    state.drizzleProcess.kill()
    state.drizzleProcess = null
    if (options?.log !== false) {
      console.log('🛑 Drizzle Studio stopped')
    }
    return true
  }
  return false
}
