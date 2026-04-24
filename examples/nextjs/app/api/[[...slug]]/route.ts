import { app } from '@/vision'

/**
 * Vision ↔ Next.js bridge.
 *
 * Next.js App Router gives us a `Request` for the catch-all `/api/[[...slug]]`
 * segment. Vision's underlying Elysia app exposes `.handle(req): Promise<Response>`
 * which is Fetch-compatible — we just need to strip the `/api` prefix so the
 * internal route `/users` matches the Next.js path `/api/users`.
 *
 * Initial bootstrap (port bind, route/service/event registration) happens in
 * `instrumentation.ts` at server boot. HMR refreshes are handled internally
 * by Vision via an idempotent `onRequest` hook, so this file stays a pure
 * bridge — no `ready()` call required here.
 *
 * All Vision features work transparently:
 * - Tracing & Dashboard (http://localhost:9500)
 * - Rate limiting (see `src/vision.ts` — POST /users is 3req/min)
 * - Pub/Sub (BullMQ in devMode → no Redis needed for demo)
 * - Type-safe Eden client (`AppType` exported from `src/vision.ts`)
 */

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)
  // Strip the Next.js `/api` prefix — Vision's registered routes live at `/users`.
  url.pathname = url.pathname.replace(/^\/api/, '') || '/'

  const stripped = new Request(url, {
    method: req.method,
    headers: req.headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : await req.blob(),
    // @ts-expect-error — `duplex` is required for Node fetch with streaming body
    duplex: 'half',
  })

  return app.handle(stripped)
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
export const OPTIONS = handler
export const HEAD = handler

// Force Node.js runtime — Vision uses `async_hooks`, BullMQ, and child_process.
export const runtime = 'nodejs'
