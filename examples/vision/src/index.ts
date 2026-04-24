import { config } from 'dotenv'
import { createVision } from '@getvision/server'

import { usersModule } from './modules/users'
import { ordersModule } from './modules/orders'
import { productsModule } from './modules/products'
import { analyticsModule } from './modules/analytics'
import { notificationsModule } from './modules/notifications'

config({ path: '.env.development' })

/**
 * Vision Basic Example — Elysia edition.
 *
 * Migrated from the Hono-based ServiceBuilder API to the Elysia module
 * pattern. Each resource lives in its own file under `src/modules/*.ts`;
 * the root simply composes them via `.use(module)`.
 *
 * Compared to the old API:
 *   - `new Vision()` + `app.service('x').endpoint(...).on(...).cron(...)`
 *   → `createVision()` + `createModule({ prefix }).use(defineEvents(...)).get(...)`
 *   - File-based routing (`app/routes/`) removed — just `import` and `.use()`.
 *   - Middleware for per-request state → Elysia `.derive/.decorate` inside the
 *     module (not shown here for brevity).
 *
 * Eden Treaty — `export type AppType = typeof app` gives a typed RPC client.
 */
const app = createVision({
  service: {
    name: 'Vision hybrid routes',
    version: '1.0.0',
    description: 'Example app using Vision Server meta-framework (Elysia)',
    integrations: {
      database: 'sqlite://./dev.db',
    },
    drizzle: {
      autoStart: true,
      port: 4983,
    },
  },
  vision: {
    enabled: true,
    port: 9500,
    apiUrl: 'http://localhost:4000',
  },
  pubsub: {
    devMode: true,
  },
})
  .use(usersModule)
  .use(ordersModule)
  .use(productsModule)
  .use(analyticsModule)
  .use(notificationsModule)
  .get('/', () => ({
    name: 'Vision Server — Basic Example',
    version: '1.0.0',
    description: 'Elysia-based modules composed via `.use()`',
    services: ['users', 'orders', 'products', 'analytics', 'notifications'],
    endpoints: [
      'GET /',
      'GET /users',
      'GET /users/:id',
      'POST /users',
      'POST /orders',
      'GET /products',
      'GET /products/:id',
      'POST /products/create',
      'GET /analytics/dashboard',
      'POST /analytics/track',
      'POST /notifications',
    ],
    dashboard: 'http://localhost:9500',
  }))

app.listen(4000)

/** Export for Eden Treaty clients. */
export type AppType = typeof app
