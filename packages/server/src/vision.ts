import type { Hono, Context, MiddlewareHandler } from 'hono'
import { VisionCore } from '@getvision/core'
import { AsyncLocalStorage } from 'async_hooks'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

/**
 * Vision context available in request handlers
 */
interface VisionContext {
  vision: VisionCore
  traceId: string
  rootSpanId: string
}

const visionContext = new AsyncLocalStorage<VisionContext>()

/**
 * Get Vision context (available in route handlers)
 * 
 * @example
 * ```ts
 * const { vision, traceId } = getVisionContext()
 * const withSpan = vision.createSpanHelper(traceId)
 * ```
 */
export function getVisionContext(): VisionContext {
  const context = visionContext.getStore()
  if (!context) {
    throw new Error('Vision context not available. Make sure Vision is enabled.')
  }
  return context
}

/**
 * Create span helper using current trace context
 * 
 * @example
 * ```ts
 * const withSpan = useVisionSpan()
 * const users = withSpan('db.select', { 'db.table': 'users' }, () => {
 *   return db.select().from(users).all()
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
    const span = tracer.startSpan(name, traceId, rootSpanId)
    
    for (const [key, value] of Object.entries(attributes)) {
      tracer.setAttribute(span.id, key, value)
    }
    
    try {
      const result = fn()
      const completedSpan = tracer.endSpan(span.id)
      
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
      
      if (completedSpan) {
        vision.getTraceStore().addSpan(traceId, completedSpan)
      }
      
      throw error
    }
  }
}

/**
 * Vision middleware options
 */
export interface VisionOptions {
  enabled?: boolean
  port?: number
  maxTraces?: number
  maxLogs?: number
  logging?: boolean
  service?: {
    name?: string
    version?: string
    description?: string
  }
}

let visionInstance: VisionCore | null = null

/**
 * Get Vision instance
 */
export function getVisionInstance(): VisionCore | null {
  return visionInstance
}

/**
 * Auto-detect package.json info
 */
function autoDetectPackageInfo(): { name: string; version: string } {
  try {
    const pkgPath = join(process.cwd(), 'package.json')
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      return {
        name: pkg.name || 'unknown',
        version: pkg.version || '0.0.0',
      }
    }
  } catch (error) {
    // Ignore errors
  }
  return { name: 'unknown', version: '0.0.0' }
}

/**
 * Create Vision middleware for Hono
 * 
 * This middleware automatically:
 * - Creates traces for all requests
 * - Adds request/response metadata
 * - Provides Vision context to handlers
 * - Broadcasts events to Vision Dashboard
 */
export function createVisionMiddleware(options: VisionOptions = {}): MiddlewareHandler {
  const { 
    enabled = true, 
    port = 9500, 
    maxTraces = 1000,
    maxLogs = 10000,
    logging = true 
  } = options

  if (!enabled) {
    return async (c, next) => await next()
  }

  // Initialize Vision Core once
  if (!visionInstance) {
    visionInstance = new VisionCore({ port, maxTraces, maxLogs })

    // Auto-detect service info
    const pkgInfo = autoDetectPackageInfo()
    const serviceName = options.service?.name || pkgInfo.name
    const serviceVersion = options.service?.version || pkgInfo.version

    // Set app status
    visionInstance.setAppStatus({
      name: serviceName,
      version: serviceVersion,
      description: options.service?.description,
      running: true,
      pid: process.pid,
      metadata: {
        framework: 'vision-sdk',
      },
    })
  }

  const vision = visionInstance

  // Middleware to trace requests
  return async (c: Context, next) => {
    // Skip OPTIONS requests
    if (c.req.method === 'OPTIONS') {
      return next()
    }

    const startTime = Date.now()
    
    // Create trace
    const trace = vision.createTrace(c.req.method, c.req.path)
    
    // Run request in AsyncLocalStorage context
    return visionContext.run({ vision, traceId: trace.id, rootSpanId: '' }, async () => {
      // Start main span
      const tracer = vision.getTracer()
      const rootSpan = tracer.startSpan('http.request', trace.id)
      
      // Update context with rootSpanId
      const ctx = visionContext.getStore()
      if (ctx) {
        ctx.rootSpanId = rootSpan.id
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
          vision.getTraceStore().addSpan(trace.id, completedSpan)
        }
        
        // Complete trace
        const duration = Date.now() - startTime
        vision.completeTrace(trace.id, c.res.status, duration)
        
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
}
