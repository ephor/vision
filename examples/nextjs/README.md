# Vision × Next.js example

Vision server mounted inside a Next.js App Router catch-all route. No separate
HTTP process — Next.js owns the socket, Vision is invoked as a WinterCG
`(req: Request) => Promise<Response>` handler.

## Run

```bash
bun --filter nextjs-vision-example dev
# Next.js: http://localhost:3100
# Vision Dashboard: http://localhost:9500 (starts on first API hit)
```

## Anatomy

| File | Purpose |
|---|---|
| `src/vision.ts` | Vision app (`createVision` + modules + rate-limit), guarded singleton for HMR |
| `app/api/[[...slug]]/route.ts` | Fetch-API bridge — strips `/api` prefix, calls `app.handle(req)` |
| `app/page.tsx` | Landing page with curl snippets |

## How the lazy init works

Vision's `onStart` lifecycle only fires when you call `.listen()`. In Next.js
we never do — instead Vision uses an `onRequest` hook that triggers
registration (services, routes, pub/sub, cron, Dashboard) on the **first**
incoming request. Subsequent requests skip the init via an internal flag.

## Constraints

- **Node.js runtime only** (`export const runtime = 'nodejs'`). Vision uses
  `async_hooks`, `child_process`, and BullMQ — none of which work on Edge /
  Cloudflare Workers. For serverless Lambdas you'd need a cold-start strategy;
  not in scope here.
- **HMR singleton** — Next.js re-imports server modules across hot-reloads.
  `src/vision.ts` stashes the instance on `globalThis.__visionApp` to avoid
  re-initializing BullMQ queues, rate-limit stores, etc.
- **Rate-limit state** is per process. For multi-instance deploys plug an
  ioredis-backed `RateLimitStore` via `rateLimit({ store: myRedisStore, ... })`.

## Rate-limit smoke test

```bash
for i in 1 2 3 4; do
  curl -s -o /dev/null -w "req $i: %{http_code}\n" \
    -X POST http://localhost:3100/api/users \
    -H 'content-type: application/json' \
    -d "{\"name\":\"u$i\",\"email\":\"u$i@example.com\"}"
done
# Expect: 200, 200, 200, 429
```
