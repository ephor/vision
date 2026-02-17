import type { Context, Env, Input, MiddlewareHandler } from 'hono'
import type { VisionCore } from '@getvision/core'

/**
 * Vision context stored in AsyncLocalStorage
 */
export interface VisionContext<E extends Env = any, P extends string = any, I extends Input = {}> extends Context<E, P, I> {
  vision: VisionCore
  traceId: string
  rootSpanId: string
}

/**
 * Endpoint configuration options
 */
export interface EndpointConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path: string
  middleware?: MiddlewareHandler[]
  // TODO: Below not implemented yet features
  auth?: boolean
  ratelimit?: { requests: number; window: string; store?: any }
  cache?: { ttl: number }
}

/**
 * Extended Context with span helper and emit
 * 
 * Generic TEvents parameter allows type-safe event emission
 */
export interface ExtendedContext<
  TEvents extends Record<string, any> = {},
  E extends Env = any,
  P extends string = any,
  I extends Input = {}
> extends Context<E, P, I> {
  span<T>(
    name: string,
    attributes?: Record<string, any>,
    fn?: () => T
  ): T

  /**
   * Add context to the current active trace
   * This is the "Wide Event" API - allowing adding high-cardinality data
   * to the current request context.
   */
  addContext(context: Record<string, unknown>): void
  
  /**
   * Emit an event with type-safe validation
   * 
   * The event name and data are validated against registered Zod schemas.
   * TypeScript will ensure:
   * 1. The event name is registered (via .on())
   * 2. The data matches the schema exactly
   * 
   * @example
   * ```ts
   * // After .on('user/created', { schema: z.object({ userId: z.string(), email: z.string() }) })
   * 
   * // ✅ TypeScript allows this:
   * await c.emit('user/created', {
   *   userId: '123',
   *   email: 'user@example.com'
   * })
   * 
   * // ❌ TypeScript errors:
   * await c.emit('unknown/event', {})  // Event not registered
   * await c.emit('user/created', { userId: '123' })  // Missing email
   * await c.emit('user/created', { userId: '123', email: 'x', extra: 'extra' })  // Extra field
   * ```
   */
  emit<K extends keyof TEvents>(
    eventName: K,
    data: TEvents[K]
  ): Promise<void>
}

/**
 * Hono Variables for Vision-injected context helpers.
 * These are set via c.set() in Vision middleware and accessible via c.var.* in handlers.
 */
export type SpanFn = <T>(
  name: string,
  attributes?: Record<string, unknown>,
  fn?: () => T
) => T

export type AddContextFn = (context: Record<string, unknown>) => void

export type EmitFn<TEvents extends Record<string, any> = Record<string, any>> = <
  K extends keyof TEvents
>(
  eventName: K,
  data: TEvents[K]
) => Promise<void>

export type VisionVariables<TEvents extends Record<string, any> = Record<string, any>> = {
  span: SpanFn
  addContext: AddContextFn
  emit: EmitFn<TEvents>
}

/**
 * Endpoint type map used by ServiceBuilder to accumulate per-endpoint types.
 * Key format: "METHOD /path" (e.g., "GET /users/:id")
 */
export type EndpointTypeMap = Record<string, { input: any; output: any }>

/**
 * Infer the accumulated endpoint types from a ServiceBuilder instance.
 *
 * ServiceBuilder carries a phantom `_endpointTypes` property (never set at
 * runtime) so TypeScript can extract the full `TEndpoints` map at compile time.
 *
 * @example
 * ```ts
 * import type { InferServiceEndpoints } from '@getvision/server'
 *
 * const userService = app.service('users')
 *   .endpoint('GET', '/users/:id', { input, output }, handler)
 *   .endpoint('POST', '/users', { input, output }, handler)
 *
 * export type AppRouter = {
 *   users: InferServiceEndpoints<typeof userService>
 * }
 * // AppRouter = {
 * //   users: {
 * //     'GET /users/:id': { input: { id: string }, output: { id: string; name: string } }
 * //     'POST /users':    { input: { name: string }, output: { id: string; name: string } }
 * //   }
 * // }
 * ```
 */
export type InferServiceEndpoints<T> = T extends { readonly _endpointTypes?: infer TEndpoints }
  ? TEndpoints
  : never

/**
 * Derive a fully-typed AppRouter from a record of ServiceBuilder instances.
 * Eliminates the need to manually maintain the AppRouter type.
 *
 * @example
 * ```ts
 * import type { InferAppRouter } from '@getvision/server'
 *
 * const _services = { users: userService, orders: orderService }
 * export type AppRouter = InferAppRouter<typeof _services>
 * // AppRouter = {
 * //   users: InferServiceEndpoints<typeof userService>
 * //   orders: InferServiceEndpoints<typeof orderService>
 * // }
 * ```
 */
export type InferAppRouter<
  TServices extends Record<string, { readonly _endpointTypes?: any }>
> = {
  [K in keyof TServices]: InferServiceEndpoints<TServices[K]>
}

/**
 * Handler type with Zod-validated input and Vision-enhanced context
 */
export type Handler<
  TInput = any,
  TOutput = any,
  TEvents extends Record<string, any> = {},
  E extends Env = any,
  P extends string = any,
  I extends Input = {}
> = (
  req: TInput,
  ctx: ExtendedContext<TEvents, E, P, I>
) => Promise<TOutput> | TOutput
