/**
 * @getvision/server — Meta-framework built on Elysia with observability.
 *
 * Features:
 * - Built on Elysia (Bun-first, end-to-end type safety via Eden Treaty)
 * - Built-in Vision Dashboard (tracing, logs, API explorer)
 * - Standard Schema validation (Zod / Valibot / TypeBox)
 * - Pub/Sub & Cron via BullMQ (automatic)
 * - Module pattern: `createModule({ prefix }).use(defineEvents(...)).get(...)`
 * - Per-request context helpers: `span`, `addContext`, `emit`, `traceId`
 *
 * @example
 * ```ts
 * import { createVision, createModule, defineEvents } from '@getvision/server'
 * import { z } from 'zod'
 *
 * const usersModule = createModule({ prefix: '/users' })
 *   .use(defineEvents({
 *     'user/created': {
 *       schema: z.object({ userId: z.string(), email: z.string() }),
 *       handler: async (event) => console.log('created', event),
 *     },
 *   }))
 *   .post('/', async ({ body, emit, span }) => {
 *     const id = span('id.generate', {}, () => crypto.randomUUID())
 *     await emit('user/created', { userId: id, email: body.email })
 *     return { id, ...body }
 *   }, {
 *     body: z.object({ name: z.string(), email: z.string().email() }),
 *   })
 *
 * const app = createVision({
 *   service: { name: 'My API', version: '1.0.0' },
 *   pubsub: { devMode: true },
 * }).use(usersModule)
 *
 * export type App = typeof app
 * app.listen(3000)
 * ```
 */

// Main factory + helpers
export {
  createVision,
  createModule,
  defineEvents,
  defineCrons,
  onEvent,
  onEvents,
  rateLimit,
  MemoryRateLimitStore,
  getVisionContext,
  ready,
} from './vision-app'

// Types
export type {
  VisionConfig,
  VisionDerived,
  VisionALSContext,
  EventConfig,
  EventMap,
  EventPayload,
  TypedEmit,
  CronConfig,
  CronMap,
  RateLimitOptions,
  RateLimitContext,
  RateLimitEntry,
  RateLimitStore,
} from './vision-app'

// Event bus (exposed for advanced use: sharing across apps, manual wiring)
export { EventBus } from './event-bus'
export type { EventBusConfig } from './event-bus'

// Re-export Elysia's native validator (TypeBox) for users who prefer it over
// Zod/Valibot. Both paths coexist — schemas pass through Standard Schema.
export { t } from 'elysia'
export type { Static, TSchema } from 'elysia'

// Re-export from core for convenience
export { VisionCore } from '@getvision/core'
export type * from '@getvision/core'
