# @getvision/core

## 0.1.1

### Patch Changes

- 5b7cb0a: feat(web): add query parameters support, custom query params, and polished UI

  Introduced support for API query parameters in the API Explorer, including the ability to add and manage custom query parameters. Refactored UI components to use a new `Checkbox` component and replaced `Card` with `SectionCard` for better consistency. Enhanced request body handling with JSON5 parsing.

## 0.1.0

### Minor Changes

- d5bfbe0: Introduce UniversalValidator with multi-library validation support for Zod, Valibot, and Standard Schema v1. Enhanced template generation now handles complex schemas with nested objects, arrays, enums, and union types.

## 0.0.8

### Patch Changes

- 2635948: Implement Wide Events concept for logging

## 0.0.7

### Patch Changes

- 96f97ad: Add apiUrl config param for adapters

## 0.0.6

### Patch Changes

- 633a138: Inject dashboard config into index.html via apiUrl and serveStatic
  Make VisionWebSocketServer options accept optional apiUrl

## 0.0.5

### Patch Changes

- d227b1d: Layout imporovements, detect drizzle runnig process

## 0.0.4

### Patch Changes

- a88ad97: Fix UI layout for events

## 0.0.2

### Patch Changes

- ae8b128: Fix production exports to dist and switch to tsc build for d.ts

## 0.0.0

### Patch Changes

- 368618d: Initial release
- 092c5c4: Remove legacy fallback ui
