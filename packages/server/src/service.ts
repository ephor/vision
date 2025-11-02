import type { Hono, Context, MiddlewareHandler, Env, Input } from 'hono'
import type { z } from 'zod'
import { VisionCore, generateZodTemplate } from '@getvision/core'
import type { EndpointConfig, Handler } from './types'
import { getVisionContext } from './vision-app'
import { eventRegistry } from './event-registry'
import type { EventBus } from './event-bus'
import { rateLimiter } from 'hono-rate-limiter'

// Simple window parser supporting values like '15m', '1h', '30s', '2d' or plain milliseconds as number string
function parseWindowMs(window: string): number {
  const trimmed = window.trim()
  if (/^\d+$/.test(trimmed)) return Number(trimmed)
  const match = trimmed.match(/^(\d+)\s*([smhd])$/i)
  if (!match) throw new Error(`Invalid ratelimit window: ${window}`)
  const value = Number(match[1])
  const unit = match[2].toLowerCase()
  const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }
  return value * multipliers[unit]
}

function getClientKey(c: Context, method: string, path: string): string {
  const ip =
    c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
    c.req.header('x-real-ip') ||
    c.req.header('cf-connecting-ip') ||
    c.req.header('fly-client-ip') ||
    c.req.header('x-client-ip') ||
    ''
  // Fallback to UA if no IP available (still scoped per endpoint)
  const ua = c.req.header('user-agent') || 'unknown'
  return `${ip || ua}:${method}:${path}`
}

/**
 * Event schema map - accumulates event types as they're registered
 */
type EventSchemaMap = Record<string, z.ZodSchema<any>>

/**
 * ServiceBuilder - Builder pattern API for defining services
 * 
 * Automatically infers event types from Zod schemas passed to .on()
 * 
 * @example
 * ```ts
 * const userService = app.service('users')
 *   .use(logger())
 *   .endpoint('GET', '/users/:id', { input, output }, handler)
 *   .on('user/created', {
 *     schema: z.object({ userId: z.string(), email: z.string() }),
 *     handler: async (event) => {
 *       // event is fully typed: { userId: string, email: string }
 *     }
 *   })
 * ```
 */
export class ServiceBuilder<
  TEvents extends EventSchemaMap = {},
  E extends Env = Env,
  I extends Input = {}
> {
  private endpoints: Map<string, any> = new Map()
  private eventHandlers: Map<string, any> = new Map()
  private cronJobs: Map<string, any> = new Map()
  private globalMiddleware: MiddlewareHandler<E, string, any, any>[] = []
  private eventSchemas: EventSchemaMap = {}
  
  constructor(
    private name: string,
    private eventBus: EventBus,
    private visionCore?: VisionCore
  ) {}
  
  /**
   * Add global middleware for all endpoints in this service
   */
  use(...middleware: MiddlewareHandler<E, string, any, any>[]) {
    this.globalMiddleware.push(...middleware)
    return this
  }

  /**
   * Get service name (capitalized) and route metadata without registering
   */
  public getRoutesMetadata(): Array<{
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
    path: string
    requestBody?: any
    responseBody?: any
  }> {
    const routes: Array<{
      method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
      path: string
      requestBody?: any
      responseBody?: any
    }> = []
    this.endpoints.forEach((ep) => {
      let requestBody = undefined
      if (ep.schema.input && ['POST', 'PUT', 'PATCH'].includes(ep.method)) {
        requestBody = generateZodTemplate(ep.schema.input)
      }
      let responseBody = undefined
      if (ep.schema.output) {
        responseBody = generateZodTemplate(ep.schema.output)
      }
      routes.push({
        method: ep.method,
        path: ep.path,
        requestBody,
        responseBody,
      })
    })
    return routes
  }

  public getDisplayName(): string {
    return this.name.charAt(0).toUpperCase() + this.name.slice(1)
  }
  
  /**
   * Define an HTTP endpoint with Zod validation
   * 
   * @example
   * ```ts
   * service.endpoint(
   *   'GET',
   *   '/users/:id',
   *   {
   *     input: z.object({ id: z.string() }),
   *     output: z.object({ id: z.string(), name: z.string() })
   *   },
   *   async ({ id }, c) => {
   *     return { id, name: 'John' }
   *   },
   *   { middleware: [authMiddleware] }
   * )
   * ```
   */
  endpoint<
    TInputSchema extends z.ZodType,
    TOutputSchema extends z.ZodType | undefined,
    PPath extends string
  >(
    method: EndpointConfig['method'],
    path: PPath,
    schema: {
      input: TInputSchema
      output?: TOutputSchema
    },
    handler: Handler<
      z.infer<TInputSchema>,
      TOutputSchema extends z.ZodType ? z.infer<TOutputSchema> : any,
      TEvents,
      E,
      PPath,
      I
    >,
    config?: Partial<EndpointConfig>
  ) {
    this.endpoints.set(`${method}:${path}`, {
      method,
      path,
      handler,
      schema,
      config: { ...config, method, path },
      middleware: config?.middleware || []
    })
    return this
  }
  
  /**
   * Subscribe to events with Zod schema validation
   * 
   * Automatically infers the event type from the Zod schema.
   * TypeScript will ensure that c.emit() calls match the registered schema.
   * 
   * @example
   * ```ts
   * service.on('user/created', {
   *   schema: z.object({
   *     userId: z.string().uuid(),
   *     email: z.string().email()
   *   }),
   *   description: 'User account created',
   *   icon: '👤',
   *   tags: ['user', 'auth'],
   *   handler: async (event) => {
   *     // event is fully typed: { userId: string, email: string }
   *     console.log('User created:', event.email)
   *   }
   * })
   * ```
   */
  on<
    K extends string,
    T extends Record<string, any>
  >(
    eventName: K,
    config: {
      schema: z.ZodSchema<T>
      description?: string
      icon?: string
      tags?: string[]
      handler: (event: T) => Promise<void>
    }
  ): ServiceBuilder<TEvents & { [key in K]: T }, E, I> {
    const { schema, handler, description, icon, tags } = config
    
    // Store schema for type inference
    this.eventSchemas[eventName] = schema
    
    // Register in event registry
    eventRegistry.registerEvent(
      eventName,
      schema,
      handler,
      { description, icon, tags }
    )
    
    // Register handler in event bus
    this.eventBus.registerHandler(eventName, handler)
    
    // Store for later reference
    this.eventHandlers.set(eventName, config)
    
    // Return typed ServiceBuilder with accumulated events
    return this as ServiceBuilder<TEvents & { [key in K]: T }, E, I>
  }
  
  /**
   * Schedule a cron job using BullMQ Repeatable
   * 
   * @example
   * ```ts
   * service.cron('0 0 * * *', {
   *   description: 'Daily cleanup',
   *   icon: '🧹',
   *   tags: ['maintenance'],
   *   handler: async (c) => {
   *     console.log('Daily cleanup')
   *   }
   * })
   * ```
   */
  cron(
    schedule: string,
    config: {
      description?: string
      icon?: string
      tags?: string[]
      handler: (context: any) => Promise<void>
    }
  ) {
    const { handler, description, icon, tags } = config
    const cronName = `${this.name}.cron.${schedule}`
    
    // Register in event registry
    eventRegistry.registerCron(
      cronName,
      schedule,
      handler,
      { description, icon, tags }
    )
    
    // Store for later reference
    this.cronJobs.set(cronName, { schedule, ...config })
    
    // Setup BullMQ repeatable job
    // This will be called when the service is built
    this.setupCronJob(cronName, schedule, handler)
    
    return this
  }
  
  /**
   * Setup BullMQ repeatable job for cron
   */
  private async setupCronJob(
    cronName: string,
    schedule: string,
    handler: (context: any) => Promise<void>
  ) {
    // Get queue from EventBus (we'll add a getQueue method)
    const queue = await this.eventBus.getQueueForCron(cronName)
    
    // Register cron job using BullMQ upsertJobScheduler
    await queue.upsertJobScheduler(
      cronName,
      {
        pattern: schedule,  // Cron expression (e.g., '0 0 * * *')
      },
      {
        name: cronName,
        data: {},
        opts: {},
      }
    )
    
    // Register worker to process cron jobs
    this.eventBus.registerCronHandler(cronName, handler)
  }
  
  /**
   * Build and register all endpoints with Hono
   */
  build(app: Hono, servicesAccumulator?: Array<{ name: string; routes: any[] }>) {
    // Prepare routes with Zod schemas
    const routes = Array.from(this.endpoints.values()).map(ep => {
      // Generate requestBody schema (input)
      let requestBody = undefined
      if (ep.schema.input && ['POST', 'PUT', 'PATCH'].includes(ep.method)) {
        requestBody = generateZodTemplate(ep.schema.input)
      }
      
      // Generate responseBody schema (output) - NEW!
      let responseBody = undefined
      if (ep.schema.output) {
        responseBody = generateZodTemplate(ep.schema.output)
      }
      
      return {
        method: ep.method,
        path: ep.path,
        handler: this.name,
        middleware: [],
        requestBody,
        responseBody,
      }
    })
    
    const capitalizedName = this.name.charAt(0).toUpperCase() + this.name.slice(1)
    
    // Add to accumulator (для батч реєстрації в buildAllServices)
    if (servicesAccumulator) {
      servicesAccumulator.push({
        name: capitalizedName,
        routes
      })
    }
    
    // Register HTTP endpoints
    this.endpoints.forEach((ep) => {
      // Prepare rate limiter when configured per-endpoint
      let rateLimitMw: MiddlewareHandler<E, string, any, any> | undefined
      const rl = ep.config?.ratelimit as EndpointConfig['ratelimit'] | undefined
      if (rl) {
        const windowMs = parseWindowMs(rl.window)
        const limit = rl.requests
        rateLimitMw = rateLimiter({
          windowMs,
          limit,
          standardHeaders: 'draft-6',
          keyGenerator: (c) => getClientKey(c, ep.method, ep.path),
          // If user provides a distributed store (e.g., RedisStore), pass it through
          ...(rl.store ? { store: rl.store } : {}),
        })
      }

      // Combine global + rate-limit (if any) + endpoint-specific middleware
      const allMiddleware = [
        ...this.globalMiddleware,
        ...(rateLimitMw ? [rateLimitMw] as MiddlewareHandler<E, string, any, any>[] : []),
        ...ep.middleware,
      ]
      
      // Create handler with middleware chain
      const finalHandler = async (c: Context<E, any, I>) => {
        try {
          // Add span helper and emit to context
          const visionCtx = getVisionContext()
          if (visionCtx && this.visionCore) {
            const { vision, traceId, rootSpanId } = visionCtx
            const tracer = vision.getTracer();
            
            // Add span() method to context
            (c as any).span = <T>(
              name: string,
              attributes: Record<string, any> = {},
              fn?: () => T
            ): T => {
              const span = tracer.startSpan(name, traceId, rootSpanId)
              
              for (const [key, value] of Object.entries(attributes)) {
                tracer.setAttribute(span.id, key, value)
              }
              
              try {
                const result = fn ? fn() : (undefined as any)
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
            
            // Add emit() method to context with type-safe event validation
            (c as any).emit = async <K extends keyof TEvents>(
              eventName: K,
              data: TEvents[K]
            ): Promise<void> => {
              return this.eventBus.emit(eventName as string, data)
            }
          }
          
          // Parse and merge params, body, query
          const params = c.req.param()
          const query = c.req.query()
          let body = {}
          
          if (['POST', 'PUT', 'PATCH'].includes(ep.method)) {
            body = await c.req.json().catch(() => ({}))
          }
          
          const input = { ...params, ...query, ...body }
          
          // Validate input with Zod
          const validated = ep.schema.input.parse(input)
          
          // Execute handler
          const result = await ep.handler(validated, c as any)

          // If an output schema exists, validate and return JSON
          if (ep.schema.output) {
            const validatedOutput = ep.schema.output.parse(result)
            return c.json(validatedOutput)
          }

          // No output schema: allow raw Response or JSON
          if (result instanceof Response) {
            return result
          }
          return c.json(result)
        } catch (error) {
          if ((error as any).name === 'ZodError') {
            return c.json({ 
              error: 'Validation error', 
              details: (error as any).errors 
            }, 400)
          }
          throw error
        }
      }
      
      // Register with middleware chain
      if (allMiddleware.length > 0) {
        app.on([ep.method], ep.path, ...allMiddleware, finalHandler)
      } else {
        app.on([ep.method], ep.path, finalHandler)
      }
    })
    
    return {
      endpoints: Array.from(this.endpoints.values()),
      eventHandlers: Array.from(this.eventHandlers.values()),
      cronJobs: Array.from(this.cronJobs.values())
    }
  }
}

