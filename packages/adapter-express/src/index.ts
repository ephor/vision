import type { Request, Response, NextFunction, Application } from 'express'
import {
  VisionCore,
  autoDetectPackageInfo,
  autoDetectIntegrations,
} from '@getvision/core'
import type { RouteMetadata, VisionExpressOptions, ServiceDefinition } from '@getvision/core'
import { AsyncLocalStorage } from 'async_hooks'
import { generateZodTemplate } from './zod-utils'

// Context storage for vision, traceId, and rootSpanId
interface VisionContext {
  vision: VisionCore
  traceId: string
  rootSpanId: string // ID of root http.request span
}

const visionContext = new AsyncLocalStorage<VisionContext>()

/**
 * Get current vision context (vision instance and traceId)
 * Available in route handlers when using visionMiddleware
 * 
 * @example
 * ```ts
 * app.get('/users', (req, res) => {
 *   const { vision, traceId } = getVisionContext()
 *   // ...
 * })
 * ```
 */
export function getVisionContext(): VisionContext {
  const context = visionContext.getStore()
  if (!context) {
    throw new Error('Vision context not available. Make sure visionMiddleware is enabled.')
  }
  return context
}

/**
 * Create span helper using current trace context
 * Child spans will be nested under the root http.request span
 * 
 * @example
 * ```ts
 * app.get('/users', async (req, res) => {
 *   const withSpan = useVisionSpan()
 *   
 *   const users = withSpan('db.select', { 'db.table': 'users' }, () => {
 *     return db.select().from(users).all()
 *   })
 * })
 * ```
 */
export function useVisionSpan() {
  const { vision, traceId, rootSpanId } = getVisionContext()
  const tracer = vision.getTracer()
  
  return <T>(
    name: string,
    attributes: Record<string, any> = {},
    fn: () => T
  ): T => {
    // Start child span with parentId = rootSpanId
    const span = tracer.startSpan(name, traceId, rootSpanId)
    console.log(`[useVisionSpan] Created span: ${name} with parentId: ${rootSpanId}`)
    
    // Add attributes
    for (const [key, value] of Object.entries(attributes)) {
      tracer.setAttribute(span.id, key, value)
    }
    
    try {
      const result = fn()
      const completedSpan = tracer.endSpan(span.id)
      
      // Add span to trace store
      if (completedSpan) {
        vision.getTraceStore().addSpan(traceId, completedSpan)
      }
      
      return result
    } catch (error) {
      tracer.setAttribute(span.id, 'error', true)
      tracer.setAttribute(
        span.id,
        'error.message',
        error instanceof Error ? error.message : String(error)
      )
      const completedSpan = tracer.endSpan(span.id)
      
      // Add span to trace store even on error
      if (completedSpan) {
        vision.getTraceStore().addSpan(traceId, completedSpan)
      }
      
      throw error
    }
  }
}


let visionInstance: VisionCore | null = null
const discoveredRoutes: RouteMetadata[] = []

/**
 * Express middleware for Vision Dashboard
 * 
 * @example
 * ```ts
 * import express from 'express'
 * import { visionMiddleware } from '@getvision/adapter-express'
 * 
 * const app = express()
 * 
 * if (process.env.NODE_ENV === 'development') {
 *   app.use(visionMiddleware({ port: 9500 }))
 * }
 * 
 * app.get('/hello', (req, res) => {
 *   res.json({ message: 'Hello!' })
 * })
 * 
 * app.listen(3000)
 * ```
 */
export function visionMiddleware(options: VisionExpressOptions = {}) {
  const enabled = options.enabled ?? (process.env.VISION_ENABLED !== 'false')
  
  if (!enabled) {
    return (req: Request, res: Response, next: NextFunction) => next()
  }

  // Initialize Vision instance
  if (!visionInstance) {
    visionInstance = new VisionCore({
      port: options.port ?? parseInt(process.env.VISION_PORT || '9500'),
      maxTraces: options.maxTraces ?? 1000,
      maxLogs: options.maxLogs ?? 10000,
      apiUrl: options.apiUrl,
    })

    // Auto-detect service info
    const pkgInfo = autoDetectPackageInfo()
    const autoIntegrations = autoDetectIntegrations()

    // Merge with user-provided config
    const serviceName = options.service?.name || pkgInfo.name
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

    visionInstance.setAppStatus({
      name: serviceName,
      version: serviceVersion,
      description: serviceDesc,
      environment: process.env.NODE_ENV || 'development',
      running: true,
      metadata: {
        framework: "Express",
        integrations: Object.keys(cleanIntegrations).length > 0 ? cleanIntegrations : undefined,
      }
    })
  }

  const vision = visionInstance
  const enableCors = options.cors !== false
  const logging = options.logging !== false

  // Return middleware function
  return (req: Request, res: Response, next: NextFunction) => {
    // Add CORS headers for Vision
    if (enableCors) {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Vision-Trace-Id, X-Vision-Session')
      res.setHeader('Access-Control-Expose-Headers', 'X-Vision-Trace-Id, X-Vision-Session')
      
      // Handle preflight
      if (req.method === 'OPTIONS') {
        return res.status(204).end()
      }
    }
    
    const startTime = Date.now()
    
    // Create trace
    const trace = vision.createTrace(req.method, req.path || req.url)
    
    // Add trace ID to response header
    res.setHeader('X-Vision-Trace-Id', trace.id)
    
    // Start main root span for the entire request
    const tracer = vision.getTracer()
    const rootSpan = tracer.startSpan('http.request', trace.id)
    
    // Add request attributes to span
    tracer.setAttribute(rootSpan.id, 'http.method', req.method)
    tracer.setAttribute(rootSpan.id, 'http.path', req.path || req.url)
    tracer.setAttribute(rootSpan.id, 'http.url', req.originalUrl || req.url)
    
    // Add query params if any
    if (req.query && Object.keys(req.query).length > 0) {
      tracer.setAttribute(rootSpan.id, 'http.query', req.query)
    }
    
    // Capture request metadata
    const requestMeta = {
      method: req.method,
      url: req.originalUrl || req.url,
      headers: req.headers,
      query: Object.keys(req.query || {}).length ? req.query : undefined,
      body: req.body,
    }
    tracer.setAttribute(rootSpan.id, 'http.request', requestMeta)
    trace.metadata = { ...trace.metadata, request: requestMeta }
    
    // Session ID tracking
    const sessionId = req.headers['x-vision-session']
    if (sessionId) {
      tracer.setAttribute(rootSpan.id, 'session.id', sessionId)
      trace.metadata = { ...trace.metadata, sessionId }
    }
    
    // Log request start if logging enabled
    if (logging) {
      const parts = [`method=${req.method}`, `path=${req.path || req.url}`]
      if (sessionId) parts.push(`sessionId=${sessionId}`)
      parts.push(`traceId=${trace.id}`)
      console.info(`INF starting request ${parts.join(' ')}`)
    }
    
    // Capture response body
    let responseBody: any = null
    let isJsonResponse = false
    const originalSend = res.send
    const originalJson = res.json
    
    res.send = function(body) {
      // Only capture if not already captured by res.json
      if (!isJsonResponse) {
        responseBody = body
      }
      return originalSend.call(this, body)
    }
    
    res.json = function(body) {
      // Capture the object BEFORE it's stringified
      responseBody = body
      isJsonResponse = true
      return originalJson.call(this, body)
    }
    
    // Wrap next() to handle completion in finally block (like Hono)
    const wrappedNext = () => {
      try {
        // Run handler in AsyncLocalStorage context with rootSpanId
        visionContext.run({ vision, traceId: trace.id, rootSpanId: rootSpan.id }, () => {
          next()
        })
      } catch (error) {
        // Track error in span
        tracer.addEvent(rootSpan.id, 'error', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        })
        tracer.setAttribute(rootSpan.id, 'error', true)
        throw error
      }
    }
    
    // Listen for response finish to complete span
    res.on('finish', () => {
      try {
        const duration = Date.now() - startTime
        
        // Add response attributes
        tracer.setAttribute(rootSpan.id, 'http.status_code', res.statusCode)
        
        const responseMeta = {
          status: res.statusCode,
          headers: res.getHeaders(),
          body: responseBody,
        }
        tracer.setAttribute(rootSpan.id, 'http.response', responseMeta)
        trace.metadata = { ...trace.metadata, response: responseMeta }
        
        // End span and add to trace
        const completedSpan = tracer.endSpan(rootSpan.id)
        if (completedSpan) {
          vision.getTraceStore().addSpan(trace.id, completedSpan)
        }
        
        // Complete trace (broadcasts to dashboard)
        vision.completeTrace(trace.id, res.statusCode, duration)
        
        // Log completion
        if (logging) {
          console.info(
            `INF request completed code=${res.statusCode} duration=${duration}ms method=${req.method} path=${req.path || req.url} traceId=${trace.id}`
          )
        }
      } catch (error) {
        console.error('Vision: Error completing trace:', error)
      }
    })
    
    // Execute next
    wrappedNext()
  }
}

/**
 * Match route path against pattern (simple glob-like matching)
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
    servicesConfig.forEach((svc) => {
      groups[svc.name] = { name: svc.name, description: svc.description, routes: [] }
    })

    groups['__uncategorized'] = { name: 'Uncategorized', routes: [] }

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

    if (groups['__uncategorized'].routes.length === 0) {
      delete groups['__uncategorized']
    }
  } else {
    // Auto-grouping: group by first path segment
    groups['root'] = { name: 'Root', routes: [] }
    
    const routesBySegment = new Map<string, RouteMetadata[]>()
    
    for (const route of routes) {
      const segments = route.path.split('/').filter(Boolean)
      const serviceName = segments.length > 0 ? segments[0] : 'root'
      
      if (!routesBySegment.has(serviceName)) {
        routesBySegment.set(serviceName, [])
      }
      routesBySegment.get(serviceName)!.push(route)
    }
    
    for (const [serviceName, serviceRoutes] of Array.from(routesBySegment.entries())) {
      const hasMultiSegment = serviceRoutes.some((r: RouteMetadata) => r.path.split('/').filter(Boolean).length > 1)
      
      if (hasMultiSegment || serviceName === 'root') {
        const capitalizedName = serviceName === 'root' ? 'Root' : serviceName.charAt(0).toUpperCase() + serviceName.slice(1)
        
        if (serviceName === 'root') {
          groups['root'].routes.push(...serviceRoutes)
        } else {
          groups[serviceName] = { name: capitalizedName, routes: serviceRoutes }
        }
      } else {
        groups['root'].routes.push(...serviceRoutes)
      }
    }
    
    if (groups['root'].routes.length === 0) {
      delete groups['root']
    }
  }

  return groups
}

/**
 * Enable automatic route discovery for Express app
 * 
 * @example
 * ```ts
 * const app = express()
 * app.use(visionMiddleware())
 * 
 * // Define routes...
 * app.get('/users', handler)
 * app.post('/users', handler)
 * 
 * // Enable auto-discovery after all routes defined
 * enableAutoDiscovery(app)
 * ```
 */
export function enableAutoDiscovery(app: Application, options?: { services?: ServiceDefinition[] }): void {
  if (!visionInstance) {
    console.warn('⚠️ Vision not initialized. Call visionMiddleware() first.')
    return
  }

  const routes: RouteMetadata[] = []
  
  // Express stores routes in app._router.stack
  const router = (app as any)._router
  
  if (!router) {
    console.warn('⚠️ Express router not found')
    return
  }

  function extractRoutes(stack: any[], basePath = '') {
    stack.forEach((layer: any) => {
      // Skip built-in middleware and Vision middleware
      if (!layer.route && layer.name && 
          ['query', 'expressInit', 'jsonParser', 'urlencodedParser', 'corsMiddleware'].includes(layer.name)) {
        return
      }
      
      if (layer.route) {
        // Regular route
        const methods = Object.keys(layer.route.methods)
        methods.forEach(method => {
          const routePath = basePath + layer.route.path
          const routeMethod = method.toUpperCase()
          
          // Try to get handler name and schema from stack
          let handlerName = 'anonymous'
          let schema: any = undefined
          
          if (layer.route.stack && layer.route.stack.length > 0) {
            // Look for zValidator middleware with schema
            for (const stackItem of layer.route.stack) {
              if (stackItem.handle && (stackItem.handle as any).__visionSchema) {
                schema = (stackItem.handle as any).__visionSchema
              }
              
              // Find the actual handler (last non-middleware function)
              if (stackItem.name && !['bound dispatch'].includes(stackItem.name)) {
                handlerName = stackItem.name
              }
            }
          }
          
          const route: RouteMetadata = {
            method: routeMethod,
            path: routePath,
            handler: handlerName,
          }
          
          if (schema) {
            route.schema = schema
            // Generate template from Zod schema
            const requestBody = generateZodTemplate(schema)
            if (requestBody) {
              route.requestBody = requestBody
            }
          }
          
          routes.push(route)
        })
      } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
        // Nested router - try to extract base path from regexp
        let routerPath = ''
        
        if (layer.regexp) {
          const regexpSource = layer.regexp.source
          // Try to extract simple path from regexp
          const match = regexpSource.match(/^\^\\\/([^\\?()]+)/)
          if (match) {
            routerPath = '/' + match[1].replace(/\\\//g, '/')
          }
        }
        
        extractRoutes(layer.handle.stack, basePath + routerPath)
      }
    })
  }

  extractRoutes(router.stack)
  
  visionInstance.registerRoutes(routes)
  
  // Group routes by services
  const grouped = groupRoutesByServices(routes, options?.services)
  const services = Object.values(grouped)
  visionInstance.registerServices(services)
  
  const schemasCount = routes.filter(r => r.schema).length
  console.log(`📋 Vision: Discovered ${routes.length} routes (${services.length} services, ${schemasCount} schemas)`)
}

/**
 * Get the current Vision instance
 */
export function getVisionInstance(): VisionCore | null {
  return visionInstance
}

// Export Zod validator for schema-based validation
export { zValidator, getRouteSchema, getAllRouteSchemas } from './zod-validator'
