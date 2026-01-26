# @getvision/adapter-hono

## 0.1.1

### Patch Changes

- 5b7cb0a: feat(web): add query parameters support, custom query params, and polished UI

  Introduced support for API query parameters in the API Explorer, including the ability to add and manage custom query parameters. Refactored UI components to use a new `Checkbox` component and replaced `Card` with `SectionCard` for better consistency. Enhanced request body handling with JSON5 parsing.

- Updated dependencies [5b7cb0a]
  - @getvision/core@0.1.1

## 0.1.0

### Minor Changes

- 6e5c887: Migrate all adapters to use UniversalValidator supporting Zod, Valibot, and Standard Schema v1. The new validation system provides:
  - Unified `validator()` function that works with any validation library
  - Automatic error response formatting with proper issue paths
  - Schema introspection for template generation
  - Backward compatibility with existing zValidator (deprecated)

  **Breaking changes:**
  - `zValidator` is now deprecated in favor of universal `validator()`
  - Error response format has been standardized across all adapters
  - Some internal types have changed to support multiple validation libraries

  Migration guide:

  ```ts
  // Before
  import { zValidator } from "@getvision/adapter-hono";
  app.post("/users", zValidator("json", userSchema));

  // After (works with Zod, Valibot, or Standard Schema)
  import { validator } from "@getvision/adapter-hono";
  app.post("/users", validator("json", userSchema));
  ```

## 0.0.11

### Patch Changes

- Updated dependencies [d5bfbe0]
  - @getvision/core@0.1.0

## 0.0.10

### Patch Changes

- 5fbff2a: bump deps versions

## 0.0.9

### Patch Changes

- 22facf0: Implement Wide Events concept for logging

## 0.0.8

### Patch Changes

- Updated dependencies [2635948]
  - @getvision/core@0.0.8

## 0.0.7

### Patch Changes

- d4ccf5d: Expose `apiUrl` in adapter and server options and pass it to VisionCore so the dashboard can target the backend API.

## 0.0.6

### Patch Changes

- Updated dependencies [96f97ad]
  - @getvision/core@0.0.7

## 0.0.5

### Patch Changes

- Updated dependencies [633a138]
  - @getvision/core@0.0.6

## 0.0.4

### Patch Changes

- Updated dependencies [d227b1d]
  - @getvision/core@0.0.5

## 0.0.3

### Patch Changes

- Updated dependencies [a88ad97]
  - @getvision/core@0.0.4

## 0.0.2

### Patch Changes

- Updated dependencies [ae8b128]
  - @getvision/core@0.0.2

## 0.0.0

### Patch Changes

- 368618d: Initial release
- Updated dependencies [368618d]
- Updated dependencies [092c5c4]
  - @getvision/core@0.0.0
