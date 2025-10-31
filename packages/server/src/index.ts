/**
 * @getvision/server - Meta-framework with built-in observability
 * 
 * Features:
 * - Built on Hono (ultra-fast, edge-ready)
 * - Built-in Vision Dashboard (tracing, logging)
 * - Type-safe Zod validation
 * - Pub/Sub & Cron via BullMQ (automatic)
 * - Service builder pattern
 * - c.span() for custom tracing
 * 
 * @example
 * ```ts
 * import { Vision } from '@getvision/server'
 * import { z } from 'zod'
 * 
 * const app = new Vision({
 *   service: {
 *     name: 'My API',
 *     version: '1.0.0'
 *   },
 *   pubsub: {
 *     schemas: {
 *       'user/created': {
 *         data: z.object({ userId: z.string() })
 *       }
 *     }
 *   }
 * })
 * 
 * const userService = app.service('users')
 *   .endpoint('GET', '/users/:id', schema, async (data, c) => {
 *     // c.span() is built-in!
 *     const user = c.span('db.select', { 'db.table': 'users' }, () => {
 *       return db.users.findOne(data.id)
 *     })
 *     return user
 *   })
 *   .on('user/created', async (event) => {
 *     console.log('User created:', event.data)
 *   })
 * 
 * app.start(3000)
 * ```
 */

// Main Vision class
export { Vision, getVisionContext } from './vision-app'
export type { VisionConfig } from './vision-app'

// Service builder (usually accessed via app.service())
export { ServiceBuilder } from './service'

// Types
export type { 
  EndpointConfig, 
  Handler, 
  VisionContext,
  ExtendedContext
} from './types'

// Re-export from core for convenience
export { VisionCore } from '@getvision/core'
export type * from '@getvision/core'
