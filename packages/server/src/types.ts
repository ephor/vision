import type { Context, MiddlewareHandler } from 'hono'
import type { z } from 'zod'
import type { VisionCore } from '@getvision/core'

/**
 * Vision context stored in AsyncLocalStorage
 */
export interface VisionContext {
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
  auth?: boolean
  ratelimit?: { requests: number; window: string }
  cache?: { ttl: number }
}

/**
 * Extended Context with span helper and emit
 * 
 * Generic TEvents parameter allows type-safe event emission
 */
export interface ExtendedContext<TEvents extends Record<string, any> = {}> extends Context {
  span<T>(
    name: string,
    attributes?: Record<string, any>,
    fn?: () => T
  ): T
  
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
 * Handler type with Zod-validated input and Vision-enhanced context
 */
export type Handler<TInput = any, TOutput = any, TEvents extends Record<string, any> = {}> = (
  req: TInput,
  ctx: ExtendedContext<TEvents>
) => Promise<TOutput> | TOutput
