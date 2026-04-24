/**
 * Next.js instrumentation hook.
 *
 * `register()` runs exactly once per Next.js server boot, before any Route
 * Handler is evaluated. We use it to eagerly bootstrap Vision:
 *
 * - bind the Dashboard port (http://localhost:9500),
 * - register the composed Elysia app's routes / services,
 * - wire queued `defineEvents` / `defineCrons`,
 * - run Drizzle Studio autodetection.
 *
 * This is the clean Next-native replacement for the previous lazy-on-first-
 * request pattern and for the short-lived sidecar experiment. The Dashboard
 * is live immediately after `next dev` is ready — no request required, no
 * heartbeat, no separate process.
 *
 * HMR: `instrumentation.ts` is evaluated once per server process and is NOT
 * re-run on module HMR. When modules like `src/modules/users.ts` change,
 * Next re-evaluates the `route.ts` module graph on the next request, which
 * rebuilds `app` with fresh handlers. `route.ts` calls `ready(app)` on that
 * fresh instance (idempotent on the original handle, a one-shot refresh on
 * a new handle) so Dashboard metadata stays in sync with the live handlers.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const [{ ready }, { app }] = await Promise.all([
    import('@getvision/server'),
    import('./src/vision'),
  ])

  await ready(app)
}
