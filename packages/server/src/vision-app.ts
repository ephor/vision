import { Hono } from 'hono'
import type { Env, Schema, Input, MiddlewareHandler } from 'hono'
import { VisionCore, runInTraceContext } from '@getvision/core'
import type { RouteMetadata } from '@getvision/core'
import { AsyncLocalStorage } from 'async_hooks'
import { existsSync } from 'fs'
import { spawn, spawnSync, type ChildProcess } from 'child_process'
import { ServiceBuilder } from './service'
import { EventBus } from './event-bus'
import { eventRegistry } from './event-registry'
import type { serve as honoServe } from '@hono/node-server'

export interface VisionALSContext {
  vision: VisionCore
  traceId: string
  rootSpanId: string
}

const visionContext = new AsyncLocalStorage<VisionALSContext>()

// Global instance tracking for hot-reload cleanup
// Must attach to globalThis because module-scoped variables are reset when the module is reloaded
const GLOBAL_VISION_KEY = '__vision_instance_state'
interface VisionGlobalState {
  instance: Vision<any, any, any> | null
  drizzleProcess: ChildProcess | null
}

// Initialize global state if needed
if (!(globalThis as any)[GLOBAL_VISION_KEY]) {
  (globalThis as any)[GLOBAL_VISION_KEY] = {
    instance: null,
    drizzleProcess: null
  }
}

function getGlobalState(): VisionGlobalState {
  return (globalThis as any)[GLOBAL_VISION_KEY]
}

async function cleanupVisionInstance(instance: Vision<any, any, any>): Promise<void> {
  const existing = (instance as any)._cleanupPromise as Promise<void> | undefined
  if (existing) return existing;

  (instance as any)._cleanupPromise = (async () => {
    const server = (instance as any).bunServer
    const hasBunServer = server && typeof server.stop === 'function'

    try {
      if (hasBunServer) {
        server.stop()
      }
      if ((globalThis as any).__vision_bun_server === server) {
        (globalThis as any).__vision_bun_server = undefined
      }
    } catch {}

    try { stopDrizzleStudio({ log: false }) } catch {}
    try { await (instance as any).eventBus?.close() } catch {}
  })()

  return (instance as any)._cleanupPromise
}

type BunServeOptions = Parameters<typeof Bun['serve']>[0]
type NodeServeOptions = Parameters<typeof honoServe>[0]

type VisionStartOptions = Omit<Partial<BunServeOptions>, 'fetch' | 'port'> &
  Omit<Partial<NodeServeOptions>, 'fetch' | 'port'>

// Simple deep merge utility (objects only, arrays are overwritten by source)
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const output: any = { ...target }
  if (source && typeof source === 'object') {
    for (const key of Object.keys(source)) {
      const srcVal = source[key]
      const tgtVal = output[key]
      if (
        srcVal &&
        typeof srcVal === 'object' &&
        !Array.isArray(srcVal) &&
        tgtVal &&
        typeof tgtVal === 'object' &&
        !Array.isArray(tgtVal)
      ) {
        output[key] = deepMerge(tgtVal, srcVal)
      } else {
        output[key] = srcVal
      }
    }
  }
  return output as T
}

/**
 * Vision Server configuration
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
    apiUrl?: string  // URL of the API server (for frontend to make HTTP requests)
  }
  routes?: {
    autodiscover?: boolean
    dirs?: string[]
  }
  pubsub?: {
    redis?: {
      host?: string
      port?: number
      password?: string
    }
    devMode?: boolean  // Use in-memory event bus (no Redis required)
    eventBus?: EventBus  // Share EventBus instance across apps (for sub-apps)
    /**
     * Default BullMQ worker concurrency for all handlers (overridable per handler)
     */
    workerConcurrency?: number
  }
}

/**
 * Vision - Meta-framework built on Hono with observability
 * 
 * @example
 * ```ts
 * const app = new Vision({
 *   service: {
 *     name: 'My API',
 *     version: '1.0.0'
 *   }
 * })
 * 
 * const userService = app.service('users')
 *   .on('user/created', handler)
 *   .endpoint('GET', '/users/:id', schema, handler)
 *
 * app.start(3000)
 * ```
 */
export class Vision<
  E extends Env = Env,
  S extends Schema = {},
  BasePath extends string = '/'
> extends Hono<E, S, BasePath> {
  private visionCore: VisionCore
  private eventBus: EventBus
  private config: VisionConfig
  private serviceBuilders: ServiceBuilder<any, E>[] = []
  private fileBasedRoutes: RouteMetadata[] = []
  private bunServer?: any
  private _cleanupPromise?: Promise<void>
  private signalHandler?: () => Promise<void>

  constructor(config?: VisionConfig) {
    super()
    
    const defaultConfig: VisionConfig = {
      service: {
        name: 'Vision SubApp',
      },
      vision: {
        enabled: false,
        port: 9500,
      },
      // Do not set a default devMode here; let EventBus derive from Redis presence
      pubsub: {},
      routes: {
        autodiscover: true,
        dirs: ['app/routes'],
      },
    }

    // Deep merge to respect nested overrides
    this.config = deepMerge(defaultConfig, config || {})
    
    // Initialize Vision Core
    const visionEnabled = this.config.vision?.enabled !== false
    const visionPort = this.config.vision?.port ?? 9500
    
    if (visionEnabled) {
      this.visionCore = new VisionCore({
        port: visionPort,
        maxTraces: this.config.vision?.maxTraces ?? 1000,
        maxLogs: this.config.vision?.maxLogs ?? 10000,
        apiUrl: this.config.vision?.apiUrl,
      })

      // Detect and optionally start Drizzle Studio
      const drizzleInfo = detectDrizzle()
      let drizzleStudioUrl: string | undefined
      
      if (drizzleInfo.detected) {
        console.log(`🗄️  Drizzle detected (${drizzleInfo.configPath})`)
        
        if (this.config.service.drizzle?.autoStart) {
          const drizzlePort = this.config.service.drizzle.port || 4983
          const started = startDrizzleStudio(drizzlePort)
          if (started) {
            drizzleStudioUrl = 'https://local.drizzle.studio'
          }
        } else {
          console.log('💡 Tip: Enable Drizzle Studio auto-start with drizzle: { autoStart: true }')
          drizzleStudioUrl = 'https://local.drizzle.studio'
        }
      }

      // Clean integrations (remove undefined values)
      const cleanIntegrations = Object.fromEntries(
        Object.entries(this.config.service.integrations || {}).filter(([_, v]) => v !== undefined)
      )

      // Set app status
      this.visionCore.setAppStatus({
        name: this.config.service.name,
        version: this.config.service.version ?? '0.0.0',
        description: this.config.service.description,
        running: true,
        pid: process.pid,
        metadata: {
          framework: 'vision-server',
          integrations: Object.keys(cleanIntegrations).length > 0 ? cleanIntegrations : undefined,
          drizzle: drizzleInfo.detected
            ? {
                detected: true,
                configPath: drizzleInfo.configPath,
                studioUrl: drizzleStudioUrl,
                autoStarted: this.config.service.drizzle?.autoStart || false,
              }
            : {
                detected: false,
                configPath: undefined,
                studioUrl: undefined,
                autoStarted: false,
              },
        },
      })
    } else {
      // Create dummy Vision Core that does nothing
      this.visionCore = null as any
    }
    
    // Use provided EventBus or create a new one
    // Root app creates EventBus, sub-apps can share it via config.pubsub.eventBus
    this.eventBus = this.config.pubsub?.eventBus || new EventBus({
      redis: this.config.pubsub?.redis,
      devMode: this.config.pubsub?.devMode,
      workerConcurrency: this.config.pubsub?.workerConcurrency,
    })
    
    // Register JSON-RPC methods for events/cron
    if (visionEnabled) {
      this.registerEventMethods()
    }
    
    // Install Vision middleware automatically
    if (visionEnabled) {
      this.installVisionMiddleware()
    }
  }

  /**
   * Register JSON-RPC methods for events and cron jobs
   */
  private registerEventMethods() {
    const server = this.visionCore.getServer()
    
    // List all events
    server.registerMethod('events/list', async () => {
      const events = eventRegistry.getAllEvents()
      return events.map(event => ({
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
    
    // List all cron jobs
    server.registerMethod('cron/list', async () => {
      const crons = eventRegistry.getAllCrons()
      return crons.map(cron => ({
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
   * Install Vision tracing middleware
   */
  private installVisionMiddleware() {
    const logging = this.config.vision?.logging !== false
    
    this.use('*', async (c, next) => {
      // Skip OPTIONS requests
      if (c.req.method === 'OPTIONS') {
        return next()
      }

      const startTime = Date.now()
      
      // Create trace
      const trace = this.visionCore.createTrace(c.req.method, c.req.path)
      
      // Run request in AsyncLocalStorage context
      return visionContext.run(
        {
          vision: this.visionCore,
          traceId: trace.id,
          rootSpanId: ''
        },
        async () => {
          // Also set core trace context so VisionCore.addContext() works
          return runInTraceContext(trace.id, async () => {
            // Start main span
            const tracer = this.visionCore.getTracer()
            const rootSpan = tracer.startSpan('http.request', trace.id)
            
            // Update context with rootSpanId
            const ctx = visionContext.getStore()
            if (ctx) {
              ctx.rootSpanId = rootSpan.id
            }

            // Provide c.span and c.addContext globally for all downstream handlers (Vision/Hono sub-apps)
            if (!(c as any).span) {
              (c as any).addContext = (context: Record<string, unknown>) => {
                const current = visionContext.getStore()
                const currentTraceId = current?.traceId || trace.id
                
                // Add context to trace metadata via VisionCore
                const visionTrace = this.visionCore.getTraceStore().getTrace(currentTraceId)
                if (visionTrace) {
                  visionTrace.metadata = { ...(visionTrace.metadata || {}), ...context }
                }
              }

              (c as any).span = <T>(
                name: string,
                attributes: Record<string, any> = {},
                fn?: () => T
              ): T => {
                const current = visionContext.getStore()
                const currentTraceId = current?.traceId || trace.id
                const currentRootSpanId = current?.rootSpanId || rootSpan.id
                const s = tracer.startSpan(name, currentTraceId, currentRootSpanId)
                for (const [k, v] of Object.entries(attributes)) tracer.setAttribute(s.id, k, v)
                try {
                  const result = fn ? fn() : (undefined as any)
                  const completed = tracer.endSpan(s.id)
                  if (completed) this.visionCore.getTraceStore().addSpan(currentTraceId, completed)
                  return result
                } catch (err) {
                  tracer.setAttribute(s.id, 'error', true)
                  tracer.setAttribute(s.id, 'error.message', err instanceof Error ? err.message : String(err))
                  const completed = tracer.endSpan(s.id)
                  if (completed) this.visionCore.getTraceStore().addSpan(currentTraceId, completed)
                  throw err
                }
              }
            }
        
              // Add request attributes
              tracer.setAttribute(rootSpan.id, 'http.method', c.req.method)
              tracer.setAttribute(rootSpan.id, 'http.path', c.req.path)
              tracer.setAttribute(rootSpan.id, 'http.url', c.req.url)

              // Add query params if any
            const url = new URL(c.req.url)
            if (url.search) {
              tracer.setAttribute(rootSpan.id, 'http.query', url.search)
            }

            // Capture request metadata
            try {
              const rawReq = c.req.raw
              const headers: Record<string, string> = {}
              rawReq.headers.forEach((v, k) => { headers[k] = v })

              const urlObj = new URL(c.req.url)
              const query: Record<string, string> = {}
              urlObj.searchParams.forEach((v, k) => { query[k] = v })

              let body: unknown = undefined
              const ct = headers['content-type'] || headers['Content-Type']
              if (ct && ct.includes('application/json')) {
                try {
                  body = await rawReq.clone().json()
                } catch {}
              }

              const sessionId = headers['x-vision-session']
              if (sessionId) {
                tracer.setAttribute(rootSpan.id, 'session.id', sessionId)
                trace.metadata = { ...(trace.metadata || {}), sessionId }
              }

              const requestMeta = {
                method: c.req.method,
                url: urlObj.pathname + (urlObj.search || ''),
                headers,
                query: Object.keys(query).length ? query : undefined,
                body,
              }
              tracer.setAttribute(rootSpan.id, 'http.request', requestMeta)
              trace.metadata = { ...(trace.metadata || {}), request: requestMeta }

              // Emit start log
              if (logging) {
                const parts = [
                  `method=${c.req.method}`,
                  `path=${c.req.path}`,
                ]
                if (sessionId) parts.push(`sessionId=${sessionId}`)
                parts.push(`traceId=${trace.id}`)
                console.info(`INF starting request ${parts.join(' ')}`)
              }

              // Execute request
              await next()

              // Add response attributes
              tracer.setAttribute(rootSpan.id, 'http.status_code', c.res.status)
              const resHeaders: Record<string, string> = {}
              c.res.headers?.forEach((v, k) => { resHeaders[k] = v as unknown as string })

              let respBody: unknown = undefined
              const resCt = c.res.headers?.get('content-type') || ''
              try {
                const clone = c.res.clone()
                if (resCt.includes('application/json')) {
                  const txt = await clone.text()
                  if (txt && txt.length <= 65536) {
                    try { respBody = JSON.parse(txt) } catch { respBody = txt }
                  }
                }
              } catch {}

              const responseMeta = {
                status: c.res.status,
                headers: Object.keys(resHeaders).length ? resHeaders : undefined,
                body: respBody,
              }
              tracer.setAttribute(rootSpan.id, 'http.response', responseMeta)
              trace.metadata = { ...(trace.metadata || {}), response: responseMeta }

            } catch (error) {
              // Track error
              tracer.addEvent(rootSpan.id, 'error', {
                message: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
              })

              tracer.setAttribute(rootSpan.id, 'error', true)
              throw error

            } finally {
              // End span and add it to trace
              const completedSpan = tracer.endSpan(rootSpan.id)
              if (completedSpan) {
                this.visionCore.getTraceStore().addSpan(trace.id, completedSpan)
              }

              // Complete trace
              const duration = Date.now() - startTime
              this.visionCore.completeTrace(trace.id, c.res.status, duration)

              // Add trace ID to response headers
              c.header('X-Vision-Trace-Id', trace.id)

              // Emit completion log
              if (logging) {
                console.info(
                  `INF request completed code=${c.res.status} duration=${duration}ms method=${c.req.method} path=${c.req.path} traceId=${trace.id}`
                )
              }
            }
          })
        }
      )
    })
  }


  /**
   * Create a new service with builder pattern
   * 
   * @example
   * ```ts
   * const userService = app.service('users')
   *   .endpoint('GET', '/users/:id', schema, handler)
   *   .on('user/created', handler)
   * ```
   */
  service<E2 extends Env = E, TEvents extends Record<string, any> = {}>(name: string) {
    const builder = new ServiceBuilder<TEvents, E2>(name, this.eventBus, this.visionCore)
    
    // Preserve builder for registration in start()
    this.serviceBuilders.push(builder as unknown as ServiceBuilder<any, E>)
    
    return builder
  }

  /**
   * Get services and routes metadata without registering to this VisionCore
   */
  public getServiceSummaries(): Array<{ name: string; routes: RouteMetadata[] }> {
    const summaries: Array<{ name: string; routes: RouteMetadata[] }> = []
    for (const builder of this.serviceBuilders) {
      const name = (builder as any).getDisplayName?.() ?? 'Service'
      const rawRoutes = (builder as any).getRoutesMetadata?.()
      if (!rawRoutes || !Array.isArray(rawRoutes)) continue
      const routes: RouteMetadata[] = rawRoutes.map((r: any) => ({
        method: r.method,
        path: r.path,
        handler: name,
        requestBody: r.requestBody,
        responseBody: r.responseBody,
      }))
      summaries.push({ name, routes })
    }
    return summaries
  }

  /**
   * Build all service builders
   */
  public buildAllServices() {
    const allServices: Array<{ name: string; routes: RouteMetadata[] }> = []
    
    // Build all services (this populates allServices via builder.build)
    for (const builder of this.serviceBuilders) {
      builder.build(this as any, allServices)
    }
    
    // Group file-based routes by path prefix (e.g., /products, /analytics)
    if (this.fileBasedRoutes.length > 0) {
      const groupedRoutes = new Map<string, RouteMetadata[]>()
      
      for (const route of this.fileBasedRoutes) {
        // Extract first path segment as service name
        const segments = route.path.split('/').filter(s => s && !s.startsWith(':'))
        const serviceName = segments[0] || 'root'
        
        if (!groupedRoutes.has(serviceName)) {
          groupedRoutes.set(serviceName, [])
        }
        groupedRoutes.get(serviceName)!.push(route)
      }
      
      // Add each group as a service
      for (const [name, routes] of groupedRoutes.entries()) {
        const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1)
        allServices.push({
          name: capitalizedName,
          routes
        })
      }
    }
    
    // Don't register to VisionCore here - let start() handle it after sub-apps are loaded
    // Just return allServices so they can be registered later
    return allServices
  }

  /**
   * Get Vision Core instance
   */
  getVision(): VisionCore {
    return this.visionCore
  }

  /**
   * Get EventBus instance
   */
  getEventBus(): EventBus {
    return this.eventBus
  }


  /**
   * Autoload Vision/Hono sub-apps from configured directories
   */
  private async autoloadRoutes(): Promise<Array<{ name: string; routes: any[] }>> {
    const enabled = this.config.routes?.autodiscover !== false
    const dirs = this.config.routes?.dirs ?? ['app/routes']
    if (!enabled) return []

    const existing: string[] = []
    for (const d of dirs) {
      try { if (existsSync(d)) existing.push(d) } catch {}
    }
    if (existing.length === 0) return []

    const { loadSubApps } = await import('./router')
    let allSubAppSummaries: Array<{ name: string; routes: any[] }> = []
    for (const d of existing) {
      try {
        // Pass EventBus to sub-apps so they share the same instance
        const summaries = await loadSubApps(this as any, d, this.eventBus)
        allSubAppSummaries = allSubAppSummaries.concat(summaries)
      } catch (e) {
        console.error(`❌ Failed to load sub-apps from ${d}:`, (e as any)?.message || e)
        if (e instanceof Error && e.stack) {
          console.error('Stack:', e.stack)
        }
      }
    }
    return allSubAppSummaries
  }

  /**
   * Start the server (convenience method)
   */
  async start(port: number = 3000, options?: VisionStartOptions) {
    const { hostname, ...restOptions } = options || {}
    const { fetch: _bf, port: _bp, ...bunRest } = restOptions as Partial<BunServeOptions>
    const { fetch: _nf, port: _np, ...nodeRest } = restOptions as Partial<NodeServeOptions>

    // Build all services WITHOUT registering to VisionCore yet
    const rootSummaries = this.buildAllServices()
    // Autoload file-based Vision/Hono sub-apps if enabled (returns merged sub-app summaries)
    const subAppSummaries = await this.autoloadRoutes()
    
    // Merge root and sub-app services by name
    const allServices = new Map<string, { name: string; routes: any[] }>()
    
    // Add root services first
    for (const summary of rootSummaries || []) {
      allServices.set(summary.name, { name: summary.name, routes: [...summary.routes] })
    }
    
    // Merge sub-app services (combine routes if service name already exists)
    for (const summary of subAppSummaries || []) {
      if (allServices.has(summary.name)) {
        const existing = allServices.get(summary.name)!
        existing.routes.push(...summary.routes)
      } else {
        allServices.set(summary.name, { name: summary.name, routes: [...summary.routes] })
      }
    }
    
    // Register all services in one call
    if (this.visionCore && allServices.size > 0) {
      const servicesToRegister = Array.from(allServices.values())
      this.visionCore.registerServices(servicesToRegister)
      const flatRoutes = servicesToRegister.flatMap(s => s.routes)
      this.visionCore.registerRoutes(flatRoutes)
      console.log(`✅ Registered ${servicesToRegister.length} total services (${flatRoutes.length} routes)`)
    }
    
    // Cleanup previous instance before starting new one (hot-reload)
    const state = getGlobalState()
    if (state.instance && state.instance !== this) {
      await cleanupVisionInstance(state.instance)
    }
    state.instance = this

    console.log(`🚀 Starting ${this.config.service.name}...`)
    console.log(`📡 API Server: http://localhost:${port}`)
    
    // Register signal handlers (cleaned up on dispose)
    if (!this.signalHandler) {
      this.signalHandler = async () => {
        const s = getGlobalState()
        if (s.instance) {
          await cleanupVisionInstance(s.instance)
        }
        try { process.exit(0) } catch {}
      }
    }

    const handleSignal = this.signalHandler

    process.removeListener('SIGINT', handleSignal)
    process.removeListener('SIGTERM', handleSignal)
    try { process.removeListener('SIGQUIT', handleSignal) } catch {}

    process.on('SIGINT', handleSignal)
    process.on('SIGTERM', handleSignal)
    try { process.on('SIGQUIT', handleSignal) } catch {}
      
    // Bun hot-reload: register dispose callback
    try {
      const hot = (import.meta as any)?.hot
      if (hot && typeof hot.dispose === 'function') {
        hot.dispose(async () => {
          console.log('♻️ Hot reload: reloading...')

          // 1. Remove signal listeners to prevent accumulation
          process.off('SIGINT', handleSignal)
          process.off('SIGTERM', handleSignal)
          try { process.off('SIGQUIT', handleSignal) } catch {}

          // 2. Cleanup this instance
          const s = getGlobalState()
          await cleanupVisionInstance(this)
          if (s.instance === this) {
            s.instance = null
          }
        })
      }
    } catch {}
    
    // Prefer Bun if available, then Node.js; otherwise instruct the user to serve manually
    if (typeof process !== 'undefined' && process.versions?.bun) {
      const BunServe = (globalThis as any).Bun?.serve
      if (typeof BunServe === 'function') {
        try {
          const existing = (globalThis as any).__vision_bun_server
          if (existing && typeof existing.stop === 'function') {
            try { existing.stop() } catch {}
          }
        } catch {}
        this.bunServer = BunServe({
          ...bunRest,
          fetch: this.fetch.bind(this),
          port,
          hostname
        })
        try { (globalThis as any).__vision_bun_server = this.bunServer } catch {}
      } else {
        console.warn('Bun detected but Bun.serve is unavailable')
        return this
      }
    } else if (typeof process !== 'undefined' && process.versions?.node) {
      const { serve } = await import('@hono/node-server')
      serve({
        ...nodeRest,
        fetch: this.fetch.bind(this),
        port,
        hostname
      })
    } else {
      // For other runtimes, just return the app
      console.log('⚠️  Use your runtime\'s serve function')
      return this
    }
  }

  /**
   * Set the EventBus instance (used internally by router to inject shared EventBus)
   */
  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus
  }
}

/**
 * Get Vision context (internal use)
 */
export function getVisionContext(): VisionALSContext | undefined {
  return visionContext.getStore()
}

// ============================================================================
// Drizzle Studio Integration
// ============================================================================

/**
 * Detect Drizzle configuration
 */
function detectDrizzle(): { detected: boolean; configPath?: string } {
  const possiblePaths = [
    'drizzle.config.ts',
    'drizzle.config.js',
    'drizzle.config.mjs',
  ]

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return { detected: true, configPath: path }
    }
  }
  return { detected: false }
}

/**
 * Start Drizzle Studio
 */
function startDrizzleStudio(port: number): boolean {
  const state = getGlobalState()
  if (state.drizzleProcess) {
    console.log('⚠️  Drizzle Studio is already running')
    return false
  }

  // If Drizzle Studio is already listening on this port, skip spawning but report available
  try {
    if (process.platform === 'win32') {
      const res = spawnSync('powershell', ['-NoProfile', '-Command', `netstat -ano | Select-String -Pattern "LISTENING\\s+.*:${port}\\s"`], { encoding: 'utf-8' })
      if ((res.stdout || '').trim().length > 0) {
        console.log(`⚠️  Drizzle Studio port ${port} already in use; assuming it is running. Skipping auto-start.`)
        return true
      }
    } else {
      const res = spawnSync('lsof', ['-i', `tcp:${port}`, '-sTCP:LISTEN'], { encoding: 'utf-8' })
      if ((res.stdout || '').trim().length > 0) {
        console.log(`⚠️  Drizzle Studio port ${port} already in use; assuming it is running. Skipping auto-start.`)
        return true
      }
    }
  } catch {}

  try {
    const proc = spawn('npx', ['drizzle-kit', 'studio', '--port', String(port), '--host', '0.0.0.0'], {
      stdio: 'inherit',
      detached: false,
      shell: process.platform === 'win32',
    })
    
    state.drizzleProcess = proc

    proc.on('error', (error) => {
      console.error('❌ Failed to start Drizzle Studio:', error.message)
    })

    proc.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`❌ Drizzle Studio exited with code ${code}`)
      }
      // Clear global state if it matches this process
      const s = getGlobalState()
      if (s.drizzleProcess === proc) {
        s.drizzleProcess = null
      }
    })

    console.log(`✅ Drizzle Studio: https://local.drizzle.studio`)
    return true
  } catch (error) {
    console.error('❌ Failed to start Drizzle Studio:', error)
    return false
  }
}

/**
 * Stop Drizzle Studio
 */
function stopDrizzleStudio(options?: { log?: boolean }): boolean {
  const state = getGlobalState()
  if (state.drizzleProcess) {
    // Remove all event listeners to prevent memory leaks
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
