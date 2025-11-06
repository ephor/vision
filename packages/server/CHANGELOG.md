# @getvision/server

## 0.2.2

### Patch Changes

- 94b139b: Bump @hono/node-server to 1.19.6
- da87b81: Update router to pass EventBus from root app to file-based sub-apps
- Updated dependencies [a88ad97]
  - @getvision/core@0.0.4

## 0.2.1

### Patch Changes

- ec9cf8b: Redis password is now passed correctly and REDIS_URL is honored.
- d0f3a53: Add event handler context

  Event handlers receive a Hono-like `Context` as the second argument. You can run service-level middleware to inject resources using `c.set(...)` and then access them in the handler via `c.get(...)`.

- 648a711: If Redis is configured use production mode in PubSub

## 0.2.0

### Minor Changes

- b49d8db: Added per-endpoint rate limiting with hono-rate-limiter: configure ratelimit in EndpointConfig with requests, window, and optional store for distributed caching. Includes docs and example.

## 0.1.0

### Minor Changes

- 5d94ff9: Thread Hono generics across Vision and ServiceBuilder, add type-safe

### Patch Changes

- ae8b128: Fix production exports to dist and switch to tsc build for d.ts
- Updated dependencies [ae8b128]
  - @getvision/core@0.0.2

## 0.0.0

### Patch Changes

- 368618d: Initial release
- Updated dependencies [368618d]
- Updated dependencies [092c5c4]
  - @getvision/core@0.0.0
