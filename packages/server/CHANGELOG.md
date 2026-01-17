# @getvision/server

## 0.3.6

### Patch Changes

- Updated dependencies [d5bfbe0]
  - @getvision/core@0.1.0

## 0.3.5

### Patch Changes

- 5fbff2a: bump deps versions

## 0.3.4

### Patch Changes

- 22facf0: Implement Wide Events concept for logging

## 0.3.3

### Patch Changes

- Updated dependencies [2635948]
  - @getvision/core@0.0.8

## 0.3.2

### Patch Changes

- 90d1d3a: Added full request/response mocking to event context including header manipulation, status codes, and proper Request object initialization.
  Removed premature event registry cleanup during hot-reload to prevent memory issues.

## 0.3.1

### Patch Changes

- 9c3a582: Improve hot-reload cleanup and prevent memory leaks during development
- 3b055ce: clean events and workers to avoid memory leaks

## 0.3.0

### Minor Changes

- 28c86e6: Added support for runtime-specific `start` options. Introduced new `VisionStartOptions` type for better handling of configuration parameters.
  Added support for configurable worker concurrency per handler and default event bus settings

### Patch Changes

- 2d4e753: Fix priority for dynamic and static routes

## 0.2.7

### Patch Changes

- d4ccf5d: Expose `apiUrl` in adapter and server options and pass it to VisionCore so the dashboard can target the backend API.

## 0.2.6

### Patch Changes

- Updated dependencies [96f97ad]
  - @getvision/core@0.0.7

## 0.2.5

### Patch Changes

- Updated dependencies [633a138]
  - @getvision/core@0.0.6

## 0.2.4

### Patch Changes

- b0ab5ad: Run in Bun environment if Bun was detected

## 0.2.3

### Patch Changes

- Updated dependencies [d227b1d]
  - @getvision/core@0.0.5

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
