import { createVision } from '@getvision/server'

import { usersModule } from './modules/users'
import { productsModule } from './modules/products'
import { ordersModule } from './modules/orders'
import { adminModule } from './modules/admin'

/**
 * Vision app for a Next.js host.
 *
 * This module is a pure builder: it creates and composes the Elysia app but
 * does NOT call `ready(app)` itself. Eager bootstrap (Dashboard port binding,
 * route registration, service discovery, cron/event wiring) is owned by
 * `instrumentation.ts` at server boot. The catch-all route also calls
 * `ready(app)` per request — idempotent on a ready handle, a one-shot refresh
 * on a new handle produced by HMR.
 *
 * HMR: no `globalThis` cache on the root app — we rebuild on every module
 * evaluation so fresh closures from edited modules reach the live app. Port
 * binding + Redis sockets are cached one layer deeper (in `VisionCore` /
 * `EventBus`), so this rebuild is cheap.
 */
function buildApp() {
  return createVision({
    service: {
      name: 'Next.js + Vision Example',
      version: '0.0.1',
      description: 'Vision mounted inside a Next.js App Router catch-all.',
    },
    vision: {
      enabled: true,
      apiUrl: 'http://localhost:3100/api',
    },
    pubsub: {
      // In-memory event bus — no Redis needed for the demo.
      devMode: true,
    },
  })
    .use(usersModule)
    .use(productsModule)
    .use(ordersModule)
    .use(adminModule)
}

export const app = buildApp()

/** Eden Treaty type — `treaty<AppType>('http://localhost:3100/api')` on the client. */
export type AppType = typeof app
