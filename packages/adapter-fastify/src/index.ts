import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import {
  VisionCore,
  autoDetectPackageInfo,
  autoDetectIntegrations,
  detectDrizzle,
  startDrizzleStudio,
  stopDrizzleStudio,
  generateTemplate,
  runInTraceContext,
  traceContext,
} from '@getvision/core'
import type {
  RequestBodySchema,
  RouteMetadata,
  SchemaField,
  Trace,
  VisionFastifyOptions,
  ServiceDefinition,
} from '@getvision/core'
import { fastifyRequestContext, requestContext } from '@fastify/request-context'

interface VisionContext {
  vision: VisionCore
  trace: Trace
  traceId: string
  rootSpanId: string
}

export function getVisionContext(): VisionContext {
  const ctx = requestContext.get('visionTrace')
  if (!ctx) {
    throw new Error('Vision context not available. Make sure visionPlugin is registered.')
  }
  return ctx
}

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


let visionInstance: VisionCore | null = null

export function getVisionInstance(): VisionCore | null {
  return visionInstance
}

const visionPluginImpl: FastifyPluginAsync<VisionFastifyOptions> = async (fastify, options) => {
  const {
    port = 9500,
    enabled = true,
    maxTraces = 1000,
    maxLogs = 10000,
    logging = true,
    cors = true,
    apiUrl
  } = options

  if (!enabled) {
    return
  }

  if (!visionInstance) {
    visionInstance = new VisionCore({
      port,
      maxTraces,
      maxLogs,
      apiUrl
    })
  }

  const vision = visionInstance

  await fastify.register(fastifyRequestContext, {
    hook: 'onRequest',
  })

  fastify.addHook('onReady', async () => {
    // Auto-detect service info
    const pkgInfo = autoDetectPackageInfo()
    const autoDetectedIntegrations = autoDetectIntegrations()

    // Merge with user-provided config
    const serviceName = options.service?.name || pkgInfo.name
    const serviceVersion = options.service?.version || pkgInfo.version
    const serviceDesc = options.service?.description
    const integrations = {
      ...autoDetectedIntegrations,
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
    vision.setAppStatus({
      name: serviceName,
      version: serviceVersion,
      description: serviceDesc,
      running: true,
      pid: process.pid,
      metadata: {
        framework: 'Fastify',
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
  })

  const CAPTURE_KEY = Symbol.for('vision.fastify.routes')
  fastify.addHook('onRoute', (routeOpts) => {
    if (!(fastify as any)[CAPTURE_KEY]) {
      (fastify as any)[CAPTURE_KEY] = []
    }
    const captured = (fastify as any)[CAPTURE_KEY]
    const methods = Array.isArray(routeOpts.method) ? routeOpts.method : [routeOpts.method]
    
    // Extract schema from preHandler validator if present
    let visionSchema: any = undefined
    if (routeOpts.preHandler) {
      const handlers = Array.isArray(routeOpts.preHandler) ? routeOpts.preHandler : [routeOpts.preHandler]
      for (const handler of handlers) {
        if ((handler as any).__visionSchema) {
          visionSchema = (handler as any).__visionSchema
          break
        }
      }
    }
    
    for (const m of methods) {
      const method = (m || '').toString().toUpperCase()
      if (!method || method === 'HEAD' || method === 'OPTIONS') continue
      
      const schema: any = routeOpts.schema ? { ...routeOpts.schema } : {}
      if (visionSchema) {
        schema.__visionSchema = visionSchema
      }
      
      captured.push({
        method,
        url: routeOpts.url as string,
        schema,
        handlerName: routeOpts.handler?.name || 'anonymous',
      })
    }
  })

  if (cors) {
    fastify.options('/*', async (request, reply) => {
      reply
        .header('Access-Control-Allow-Origin', '*')
        .header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
        .header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Vision-Trace-Id, X-Vision-Session')
        .header('Access-Control-Expose-Headers', 'X-Vision-Trace-Id, X-Vision-Session')
        .code(204)
        .send()
    })

    fastify.addHook('onRequest', async (request, reply) => {
      reply.header('Access-Control-Allow-Origin', '*')
      reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
      reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Vision-Trace-Id, X-Vision-Session')
      reply.header('Access-Control-Expose-Headers', 'X-Vision-Trace-Id, X-Vision-Session')
    })
  }

  fastify.addHook('onRequest', async (request, reply) => {
    if (request.method === 'OPTIONS') return

    const startTime = Date.now();
    (request as any).visionStartTime = startTime

    const trace = vision.createTrace(request.method, request.url)

    reply.header('X-Vision-Trace-Id', trace.id)

    const tracer = vision.getTracer()
    const rootSpan = tracer.startSpan('http.request', trace.id);

    request.requestContext.set('visionTrace', {
      vision,
      trace,
      traceId: trace.id,
      rootSpanId: rootSpan.id,
    })

    // Set core trace context for ConsoleInterceptor
    // Fastify's onRequest hook doesn't wrap the handler execution in a callback,
    // so we use enterWith() to set the context for the remainder of the sync execution
    // and hopefully async chain if not broken.
    if (traceContext) {
      traceContext.enterWith(trace.id)
    }

    tracer.setAttribute(rootSpan.id, 'http.method', request.method)
    tracer.setAttribute(rootSpan.id, 'http.path', request.url)
    tracer.setAttribute(rootSpan.id, 'http.url', request.url)

    if (request.query && Object.keys(request.query).length > 0) {
      tracer.setAttribute(rootSpan.id, 'http.query', request.query)
    }

    const requestMeta = {
      method: request.method,
      url: request.url,
      headers: request.headers,
      query: Object.keys(request.query || {}).length ? request.query : undefined,
      body: request.body,
    }
    tracer.setAttribute(rootSpan.id, 'http.request', requestMeta)
    trace.metadata = { ...trace.metadata, request: requestMeta }

    const sessionId = request.headers['x-vision-session']
    if (sessionId) {
      tracer.setAttribute(rootSpan.id, 'session.id', sessionId)
      trace.metadata = { ...trace.metadata, sessionId }
    }

    if (logging) {
      const parts = [`method=${request.method}`, `path=${request.url}`]
      if (sessionId) parts.push(`sessionId=${sessionId}`)
      parts.push(`traceId=${trace.id}`)
      console.info(`INF starting request ${parts.join(' ')}`)
    }
  })

  fastify.addHook('onResponse', async (request, reply) => {
    if (request.method === 'OPTIONS') return

    const startTime = (request as any).visionStartTime
    const context = request.requestContext.get('visionTrace') as VisionContext | undefined
    if (!context || !startTime) return
    const { vision, trace, traceId, rootSpanId } = context
    const tracer = vision.getTracer()

    try {
      const duration = Date.now() - startTime
      const rootSpan = tracer.getSpan(rootSpanId)
      if (!rootSpan) return

      tracer.setAttribute(rootSpan.id, 'http.status_code', reply.statusCode)

      const responseMeta = {
        status: reply.statusCode,
        headers: reply.getHeaders(),
      }
      tracer.setAttribute(rootSpan.id, 'http.response', responseMeta)
      trace.metadata = { ...trace.metadata, response: responseMeta }

      const completedSpan = tracer.endSpan(rootSpan.id)
      if (completedSpan) {
        vision.getTraceStore().addSpan(traceId, completedSpan)
      }

      vision.completeTrace(traceId, reply.statusCode, duration)

      if (logging) {
        console.info(
          `INF request completed code=${reply.statusCode} duration=${duration}ms method=${request.method} path=${request.url} traceId=${traceId}`
        )
      }
    } catch (error) {
      console.error('Vision: Error completing trace:', error)
    }
  })
}

export const visionPlugin = fp(visionPluginImpl, {
  fastify: '5.x',
  name: '@getvision/adapter-fastify'
})

export function enableAutoDiscovery(
  fastify: FastifyInstance,
  options?: { services?: ServiceDefinition[] }
): void {
  const vision = visionInstance
  if (!vision) {
    console.warn('Vision not initialized. Call visionPlugin first.')
    return
  }

  fastify.addHook('onReady', async () => {
    const routes: RouteMetadata[] = []
    const services: Record<string, { name: string; description?: string; routes: RouteMetadata[] }> = {}

    // Use captured routes from onRoute hook
    const CAPTURE_KEY = Symbol.for('vision.fastify.routes')
    const capturedRoutes = (fastify as any)[CAPTURE_KEY] || []

    for (const route of capturedRoutes) {
      const routeMeta: RouteMetadata = {
        method: route.method,
        path: route.url,
        handler: route.handlerName || 'anonymous',
      }

      // Try to get schema from route
      if (route.schema?.__visionSchema) {
        try {
          routeMeta.requestBody = generateTemplate(route.schema.__visionSchema)
        } catch (e) {
          console.error(`[Vision] Template generation error for ${route.method} ${route.url}:`, e)
        }
      } else if (route.schema?.body) {
        try {
          routeMeta.requestBody = jsonSchemaToTemplate(route.schema.body)
        } catch (e) {
          // Ignore schema conversion errors
        }
      }

      // Try to get response schema (Fastify supports response: { 200: { ... } })
      if (route.schema?.response) {
        try {
          // Get the success response schema (200, 201, etc.)
          const responseSchema = route.schema.response['200'] || 
                                 route.schema.response['201'] || 
                                 route.schema.response['2xx']
          if (responseSchema) {
            routeMeta.responseBody = jsonSchemaToTemplate(responseSchema)
          }
        } catch (e) {
          // Ignore schema conversion errors
        }
      }

      routes.push(routeMeta)

      // Group into services
      const serviceName = findServiceForRoute(routeMeta.path, options?.services)
      if (!services[serviceName]) {
        services[serviceName] = {
          name: serviceName,
          routes: [],
        }
      }
      services[serviceName].routes.push(routeMeta)
    }

    vision.registerRoutes(routes)
    vision.registerServices(Object.values(services))

    console.info(`Vision: Discovered ${routes.length} routes across ${Object.keys(services).length} services`)
  })
}

function jsonSchemaToTemplate(schema: any): RequestBodySchema {
  if (!schema || typeof schema !== 'object') {
    return {
      template: '{}',
      fields: [],
    }
  }

  const lines: string[] = ['{']
  const fields: SchemaField[] = []

  if (schema.properties && typeof schema.properties === 'object') {
    const props = Object.entries(schema.properties)
    const required: string[] = Array.isArray(schema.required) ? schema.required : []

    props.forEach(([key, prop]: [string, any], index) => {
      const isRequired = required.includes(key)
      const description = prop?.description || ''
      const type = Array.isArray(prop?.type) ? prop.type[0] : prop?.type || 'any'

      let value: string
      switch (type) {
        case 'string':
          value = prop?.format === 'email' ? '"user@example.com"' : '"string"'
          break
        case 'number':
        case 'integer':
          value = '0'
          break
        case 'boolean':
          value = 'false'
          break
        case 'array':
          value = '[]'
          break
        case 'object':
          value = '{}'
          break
        default:
          value = 'null'
      }

      const comma = index < props.length - 1 ? ',' : ''
      lines.push(`  "${key}": ${value}${comma}`)

      fields.push({
        name: key,
        type,
        description: description || undefined,
        required: isRequired,
        example: prop?.examples?.[0],
      })
    })
  }

  lines.push('}')
  return {
    template: lines.join('\n'),
    fields,
  }
}

function findServiceForRoute(path: string, customServices?: ServiceDefinition[]): string {
  if (customServices) {
    for (const service of customServices) {
      for (const pattern of service.routes) {
        if (matchPattern(path, pattern)) {
          return service.name
        }
      }
    }
  }

  const segments = path.split('/').filter(Boolean)
  if (segments.length === 0) return 'Root'

  // Find first non-param segment
  const firstSegment = segments.find(s => !s.startsWith(':')) || segments[0]
  
  // Skip param-only paths
  if (firstSegment.startsWith(':')) return 'Root'
  
  return firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1)
}

function matchPattern(path: string, pattern: string): boolean {
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2)
    return path === prefix || path.startsWith(prefix + '/')
  }
  return path === pattern
}

export { generateZodTemplate } from '@getvision/core'

export { validator, toFastifySchema } from './validator'