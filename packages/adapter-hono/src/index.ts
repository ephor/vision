import type { Context, MiddlewareHandler } from 'hono'
import {
  VisionCore,
  generateZodTemplate,
  autoDetectPackageInfo,
  autoDetectIntegrations,
  detectDrizzle,
  startDrizzleStudio,
  stopDrizzleStudio,
} from '@getvision/core'
import type { RouteMetadata, VisionHonoOptions, ServiceDefinition } from '@getvision/core'
import { existsSync } from 'fs'
import { AsyncLocalStorage } from 'async_hooks'
import { extractSchema } from './zod-validator'

// Context storage for vision and traceId
interface VisionContext {
  vision: VisionCore
  traceId: string
}

const visionContext = new AsyncLocalStorage<VisionContext>()

/**
 * Get current vision context (vision instance and traceId)
 * Available in route handlers when using visionAdapter
 * 
 * @example
 * ```ts
 * app.get('/users', async (c) => {
 *   const { vision, traceId } = getVisionContext()
 *   const withSpan = vision.createSpanHelper(traceId)
 *   // ...
 * })
 * ```
 */
export function getVisionContext(): VisionContext {
  const context = visionContext.getStore()
  if (!context) {
    throw new Error('Vision context not available. Make sure visionAdapter middleware is enabled.')
  }
  return context
}

/**
 * Create span helper using current trace context
 * Shorthand for: getVisionContext() + vision.createSpanHelper()
 * 
 * @example
 * ```ts
 * app.get('/users', async (c) => {
 *   const withSpan = useVisionSpan()
 *   
 *   const users = withSpan('db.select', { 'db.table': 'users' }, () => {
 *     return db.select().from(users).all()
 *   })
 * })
 * ```
 */
export function useVisionSpan() {
  const { vision, traceId } = getVisionContext()
  return vision.createSpanHelper(traceId)
}


/**
 * Hono adapter for Vision Dashboard
 * 
 * @example
 * ```ts
 * import { Hono } from 'hono'
 * import { visionAdapter } from '@vision/adapter-hono'
 * 
 * const app = new Hono()
 * 
 * if (process.env.NODE_ENV === 'development') {
 *   app.use('*', visionAdapter({ port: 9500 }))
 * }
 * ```
 */
// Global Vision instance to share across middleware
let visionInstance: VisionCore | null = null
const discoveredRoutes: RouteMetadata[] = []
let registerTimer: NodeJS.Timeout | null = null

function scheduleRegistration(options?: { services?: ServiceDefinition[] }) {
  if (!visionInstance) return
  if (registerTimer) clearTimeout(registerTimer)
  registerTimer = setTimeout(() => {
    if (!visionInstance || discoveredRoutes.length === 0) return
    visionInstance.registerRoutes(discoveredRoutes)
    const grouped = groupRoutesByServices(discoveredRoutes, options?.services)
    const services = Object.values(grouped)
    visionInstance.registerServices(services)
    console.log(`📋 Auto-discovered ${discoveredRoutes.length} routes (${services.length} services)`)
  }, 100)
}


/**
 * Auto-discover routes by patching Hono app methods
 */
function patchHonoApp(app: any, options?: { services?: ServiceDefinition[] }) {
  const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head']
  
  methods.forEach(method => {
    const original = app[method]
    if (original) {
      app[method] = function(path: string, ...handlers: any[]) {
        // Try to extract Zod schema from zValidator middleware
        let requestBodySchema = undefined
        
        for (const handler of handlers) {
          const schema = extractSchema(handler)
          if (schema) {
            requestBodySchema = generateZodTemplate(schema)
            break
          }
        }
        
        // Register route with Vision
        discoveredRoutes.push({
          method: method.toUpperCase(),
          path,
          handler: handlers[handlers.length - 1]?.name || 'anonymous',
          middleware: [],
          requestBody: requestBodySchema,
        })
        
        // Call original method
        const result = original.call(this, path, ...handlers)
        scheduleRegistration(options)
        return result
      }
    }
  })

  // Patch routing of child apps to capture their routes with base prefix
  const originalRoute = app.route
  if (originalRoute && typeof originalRoute === 'function') {
    app.route = function(base: string, child: any) {
      // Attempt to read child routes and register them with base prefix
      try {
        const routes = (child as any)?.routes
        if (Array.isArray(routes)) {
          for (const r of routes) {
            const method = (r?.method || r?.methods?.[0] || '').toString().toUpperCase() || 'GET'
            const rawPath = r?.path || r?.pattern?.path || r?.pattern || '/'
            const childPath = typeof rawPath === 'string' ? rawPath : '/'
            const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base
            const normalizedChild = childPath === '/' ? '' : (childPath.startsWith('/') ? childPath : `/${childPath}`)
            const fullPath = `${normalizedBase}${normalizedChild}` || '/'
            discoveredRoutes.push({
              method,
              path: fullPath,
              handler: r?.handler?.name || 'anonymous',
              middleware: [],
            })
          }
          scheduleRegistration(options)
        }
      } catch {}
      return originalRoute.call(this, base, child)
    }
  }
}

/**
 * Resolve endpoint template (e.g. /users/:id) for a concrete path
 */
function resolveEndpointTemplate(method: string, concretePath: string): { endpoint: string; handler: string } {
  const candidates = discoveredRoutes.filter((r) => r.method === method.toUpperCase())
  for (const r of candidates) {
    const pattern = '^' + r.path.replace(/:[^/]+/g, '[^/]+') + '$'
    const re = new RegExp(pattern)
    if (re.test(concretePath)) {
      return { endpoint: r.path, handler: r.handler || 'anonymous' }
    }
  }
  return { endpoint: concretePath, handler: 'anonymous' }
}

/**
 * Extract params by comparing template path with concrete path
 * e.g. template=/users/:id, concrete=/users/123 => { id: '123' }
 */
function extractParams(template: string, concrete: string): Record<string, string> | undefined {
  const tParts = template.split('/').filter(Boolean)
  const cParts = concrete.split('/').filter(Boolean)
  if (tParts.length !== cParts.length) return undefined
  const result: Record<string, string> = {}
  tParts.forEach((seg, i) => {
    if (seg.startsWith(':')) {
      result[seg.slice(1)] = cParts[i]
    }
  })
  return Object.keys(result).length ? result : undefined
}

export function visionAdapter(options: VisionHonoOptions = {}): MiddlewareHandler {
  const { enabled = true, port = 9500, maxTraces = 1000, logging = true } = options

  if (!enabled) {
    return async (c, next) => await next()
  }

  // Initialize Vision Core once
  if (!visionInstance) {
    visionInstance = new VisionCore({ port, maxTraces })

    // Auto-detect service info
    const pkgInfo = autoDetectPackageInfo()
    const autoIntegrations = autoDetectIntegrations()

    // Merge with user-provided config
    const serviceName = options.service?.name || options.name || pkgInfo.name
    const serviceVersion = options.service?.version || pkgInfo.version
    const serviceDesc = options.service?.description
    const integrations = {
      ...autoIntegrations,
      ...options.service?.integrations,
    }

    // Filter out undefined values from integrations
    const cleanIntegrations: Record<string, string> = {}
    for (const [key, value] of Object.entries(integrations)) {
      if (value !== undefined) {
        cleanIntegrations[key] = value
      }
    }

    // Detect and optionally start Drizzle Studio
    const drizzleInfo = detectDrizzle()
    let drizzleStudioUrl: string | undefined
    
    if (drizzleInfo.detected) {
      console.log(`🗄️  Drizzle detected (${drizzleInfo.configPath})`)
      
      if (options.drizzle?.autoStart) {
        const drizzlePort = options.drizzle.port || 4983
        const started = startDrizzleStudio(drizzlePort)
        if (started) {
          // Drizzle Studio uses local.drizzle.studio domain (with HTTPS)
          drizzleStudioUrl = 'https://local.drizzle.studio'
        }
      } else {
        console.log('💡 Tip: Enable Drizzle Studio auto-start with drizzle: { autoStart: true }')
        drizzleStudioUrl = 'https://local.drizzle.studio'
      }
    }

    // Set app status with service metadata
    visionInstance.setAppStatus({
      name: serviceName,
      version: serviceVersion,
      description: serviceDesc,
      running: true,
      pid: process.pid,
      metadata: {
        framework: 'hono',
        integrations: Object.keys(cleanIntegrations).length > 0 ? cleanIntegrations : undefined,
        drizzle: drizzleInfo.detected
          ? {
              detected: true,
              configPath: drizzleInfo.configPath,
              studioUrl: drizzleStudioUrl,
              autoStarted: options.drizzle?.autoStart || false,
            }
          : undefined,
      },
    })

    // Cleanup on exit
    process.on('SIGINT', () => {
      stopDrizzleStudio()
      process.exit(0)
    })

    process.on('SIGTERM', () => {
      stopDrizzleStudio()
      process.exit(0)
    })
  }

  const vision = visionInstance

  // Middleware to trace requests
  return async (c: Context, next) => {
    // Skip tracing for OPTIONS requests (CORS preflight)
    if (c.req.method === 'OPTIONS') {
      return next()
    }

    const startTime = Date.now()
    
    // Create trace
    const trace = vision.createTrace(c.req.method, c.req.path)
    
    // Run request in AsyncLocalStorage context
    return visionContext.run({ vision, traceId: trace.id }, async () => {
      // Also add to Hono context for compatibility
      c.set('vision', vision)
      c.set('traceId', trace.id)
      
      // Start main span
      const tracer = vision.getTracer()
      const span = tracer.startSpan('http.request', trace.id)
    
    // Add request attributes
    tracer.setAttribute(span.id, 'http.method', c.req.method)
    tracer.setAttribute(span.id, 'http.path', c.req.path)
    tracer.setAttribute(span.id, 'http.url', c.req.url)
    
    // Add query params if any
    const url = new URL(c.req.url)
    if (url.search) {
      tracer.setAttribute(span.id, 'http.query', url.search)
    }

    // Capture request metadata (headers, query, body if json)
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
        tracer.setAttribute(span.id, 'session.id', sessionId)
        trace.metadata = { ...(trace.metadata || {}), sessionId }
      }

      const requestMeta = {
        method: c.req.method,
        url: urlObj.pathname + (urlObj.search || ''),
        headers,
        query: Object.keys(query).length ? query : undefined,
        body,
      }
      tracer.setAttribute(span.id, 'http.request', requestMeta)
      // Also mirror to trace-level metadata for convenience
      trace.metadata = { ...(trace.metadata || {}), request: requestMeta }

      // Emit start log (if enabled)
      if (logging) {
        const { endpoint, handler } = resolveEndpointTemplate(c.req.method, c.req.path)
        const params = extractParams(endpoint, c.req.path)
        const parts = [
          `method=${c.req.method}`,
          `endpoint=${endpoint}`,
          `service=${handler}`,
        ]
        if (params) parts.push(`params=${JSON.stringify(params)}`)
        if (Object.keys(query).length) parts.push(`query=${JSON.stringify(query)}`)
        if ((trace.metadata as any)?.sessionId) parts.push(`sessionId=${(trace.metadata as any).sessionId}`)
        parts.push(`traceId=${trace.id}`)
        console.info(`INF starting request ${parts.join(' ')}`)
      }

      // Execute request
      await next()
      
      // Add response attributes
      tracer.setAttribute(span.id, 'http.status_code', c.res.status)
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
      tracer.setAttribute(span.id, 'http.response', responseMeta)
      trace.metadata = { ...(trace.metadata || {}), response: responseMeta }
      
    } catch (error) {
      // Track error
      tracer.addEvent(span.id, 'error', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      })
      
      tracer.setAttribute(span.id, 'error', true)
      throw error
      
    } finally {
      // End span and add it to trace
      const completedSpan = tracer.endSpan(span.id)
      if (completedSpan) {
        vision.getTraceStore().addSpan(trace.id, completedSpan)
      }
      
      // Complete trace
      const duration = Date.now() - startTime
      vision.completeTrace(trace.id, c.res.status, duration)
      
      // Add trace ID to response headers so client can correlate metrics
      c.header('X-Vision-Trace-Id', trace.id)

      // Emit completion log (if enabled)
      if (logging) {
        const { endpoint } = resolveEndpointTemplate(c.req.method, c.req.path)
        console.info(
          `INF request completed code=${c.res.status} duration=${duration}ms method=${c.req.method} endpoint=${endpoint} traceId=${trace.id}`
        )
      }
    }
    }) // Close visionContext.run()
  }
}


/**
 * Match route path against pattern (simple glob-like matching)
 * e.g., '/users/*' matches '/users/list', '/users/123'
 */
function matchPattern(path: string, pattern: string): boolean {
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2)
    return path === prefix || path.startsWith(prefix + '/')
  }
  return path === pattern
}

/**
 * Group routes by services (auto or manual)
 */
function groupRoutesByServices(
  routes: RouteMetadata[],
  servicesConfig?: ServiceDefinition[]
): Record<string, { name: string; description?: string; routes: RouteMetadata[] }> {
  const groups: Record<string, { name: string; description?: string; routes: RouteMetadata[] }> = {}

  // Manual grouping if config provided
  if (servicesConfig && servicesConfig.length > 0) {
    // Initialize groups from config
    servicesConfig.forEach((svc) => {
      groups[svc.name] = { name: svc.name, description: svc.description, routes: [] }
    })

    // Uncategorized group
    groups['__uncategorized'] = { name: 'Uncategorized', routes: [] }

    // Assign routes to services
    routes.forEach((route) => {
      let matched = false
      for (const svc of servicesConfig) {
        if (svc.routes.some((pattern) => matchPattern(route.path, pattern))) {
          groups[svc.name].routes.push(route)
          matched = true
          break
        }
      }
      if (!matched) {
        groups['__uncategorized'].routes.push(route)
      }
    })

    // Remove empty uncategorized
    if (groups['__uncategorized'].routes.length === 0) {
      delete groups['__uncategorized']
    }
  } else {
    // Auto-grouping: group by first path segment
    // If a resource has any subpaths, all its routes go to that service
    
    // First pass: collect all routes by first segment
    const routesBySegment = new Map<string, RouteMetadata[]>()
    
    for (const route of routes) {
      const segments = route.path.split('/').filter(Boolean)
      const serviceName = segments.length > 0 ? segments[0] : 'root'
      
      if (!routesBySegment.has(serviceName)) {
        routesBySegment.set(serviceName, [])
      }
      routesBySegment.get(serviceName)!.push(route)
    }
    
    // Second pass: if a service has any multi-segment routes, keep it as a service
    // Otherwise move single-segment routes to Root
    groups['root'] = { name: 'Root', routes: [] }
    
    for (const [serviceName, serviceRoutes] of routesBySegment) {
      const hasMultiSegment = serviceRoutes.some(r => r.path.split('/').filter(Boolean).length > 1)
      
      if (hasMultiSegment || serviceName === 'root') {
        // This is a real service with subpaths, or it's root
        const capitalizedName = serviceName === 'root' ? 'Root' : serviceName.charAt(0).toUpperCase() + serviceName.slice(1)
        
        if (serviceName === 'root') {
          groups['root'].routes.push(...serviceRoutes)
        } else {
          groups[serviceName] = { name: capitalizedName, routes: serviceRoutes }
        }
      } else {
        // Single-segment route with no siblings → goes to Root
        groups['root'].routes.push(...serviceRoutes)
      }
    }
    
    // Remove Root if empty
    if (groups['root'].routes.length === 0) {
      delete groups['root']
    }
  }

  return groups
}

/**
 * Enable auto-discovery of routes (experimental)
 * Patches Hono app methods to automatically register routes
 * 
 * @example
 * ```ts
 * const app = new Hono()
 * app.use('*', visionAdapter())
 * enableAutoDiscovery(app)
 * 
 * // Routes defined after this will be auto-discovered
 * app.get('/hello', (c) => c.json({ hello: 'world' }))
 * ```
 */
export function enableAutoDiscovery(app: any, options?: { services?: ServiceDefinition[] }) {
  patchHonoApp(app, options)
  scheduleRegistration(options)
}

/**
 * Get the Vision instance (for advanced usage)
 */
export function getVisionInstance(): VisionCore | null {
  return visionInstance
}

// Re-export monkey-patched zValidator that stores schema for Vision introspection
// Use this instead of @hono/zod-validator to enable automatic schema detection
export { zValidator } from './zod-validator'
