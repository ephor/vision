# CLAUDE.md - AI Assistant Guide for Vision

> **Last Updated:** 2026-01-24
> **Repository:** Vision - Universal Observability Dashboard for API Development

This document provides comprehensive guidance for AI assistants working with the Vision codebase. It covers architecture, conventions, workflows, and best practices.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Repository Structure](#repository-structure)
3. [Development Environment](#development-environment)
4. [Key Architectural Concepts](#key-architectural-concepts)
5. [Code Conventions](#code-conventions)
6. [Development Workflows](#development-workflows)
7. [Testing Guidelines](#testing-guidelines)
8. [Common Tasks](#common-tasks)
9. [Package-Specific Notes](#package-specific-notes)
10. [Troubleshooting](#troubleshooting)

---

## Project Overview

**Vision** is a development dashboard that provides unified observability across protocols and validation libraries. It's designed to add monitoring, tracing, and debugging capabilities to existing Express, Fastify, or Hono applications, or be used as a standalone meta-framework.

### Core Features
- Multi-protocol support (REST, with GraphQL, tRPC, MCP in development)
- Universal validation integration (Zod, Valibot, Standard Schema v1)
- Real-time tracing and logging via WebSocket
- API playground with multi-tab testing
- Automatic request template generation
- "Wide Events" logging philosophy (add context once, see it everywhere)

### Technology Stack
- **Language:** TypeScript (strict mode)
- **Package Manager:** Bun 1.3.0
- **Monorepo Tool:** Turborepo 2.5.9+
- **Test Framework:** Bun Test
- **Build Tool:** TypeScript Compiler (tsc)
- **Frameworks:** Hono, Express, Fastify
- **Validation:** Zod, Valibot (peer dependencies)
- **WebSocket:** ws library with JSON-RPC 2.0

---

## Repository Structure

```
vision/
├── packages/               # Core packages
│   ├── core/              # Core tracing, validation, WebSocket server
│   ├── server/            # Meta-framework built on Hono
│   ├── adapter-express/   # Express.js adapter
│   ├── adapter-fastify/   # Fastify adapter
│   ├── adapter-hono/      # Hono adapter
│   ├── ui/                # Shared React components
│   ├── eslint-config/     # Shared ESLint configuration
│   └── typescript-config/ # Shared TypeScript configurations
├── apps/                  # Applications
│   ├── web/               # Dashboard web app (Vite + React)
│   └── docs/              # Documentation site
├── examples/              # Example applications
│   ├── express/           # Express example
│   ├── fastify/           # Fastify example
│   ├── hono/              # Hono example
│   └── vision/            # Vision Server example
├── .changeset/            # Changesets for versioning
├── .github/workflows/     # CI/CD workflows
└── [config files]         # Root configuration files
```

### Key Configuration Files
- `package.json` - Root workspace configuration
- `turbo.json` - Turborepo build configuration
- `bun.lock` - Dependency lock file
- `.eslintrc.js` - ESLint configuration
- `.npmrc` - NPM configuration (auto-install-peers = true)
- `.gitignore` - Git ignore patterns

---

## Development Environment

### Prerequisites
- **Bun:** 1.3.0 (required, specified in `packageManager` field)
- **Node.js:** 20+ (for compatibility)
- **Git:** For version control

### Initial Setup

```bash
# Clone repository
git clone https://github.com/ephor/vision.git
cd vision

# Install dependencies
bun install --frozen-lockfile

# Build all packages
bun run build

# Run tests
bun run test

# Start example application
bun example:hono
```

### Available Scripts

```bash
# Build & Development
bun run build          # Build all packages (Turbo)
bun run dev            # Run all packages in dev mode
bun run test           # Run all tests
bun run lint           # Lint all packages
bun run format         # Format code with Prettier

# Examples
bun example:hono       # Run Hono example
bun example:express    # Run Express example
bun example:fastify    # Run Fastify example
bun example:server     # Run Vision Server example

# Documentation
bun docs:dev           # Run docs in dev mode
bun docs:build         # Build docs

# Versioning & Release
bun run changeset      # Create a changeset
bun run ci:version     # Version packages
bun run release        # Build and publish packages
```

---

## Key Architectural Concepts

### 1. Monorepo with Turborepo

Vision uses **Turborepo** for efficient builds with dependency graph awareness:

- **Build caching:** Builds are cached based on inputs
- **Parallel execution:** Independent tasks run concurrently
- **Dependency tracking:** Packages build in topological order
- **Workspace protocol:** Internal dependencies use `workspace:*`

**Turborepo Configuration (`turbo.json`):**
```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "out/**", ".next/**"]
    },
    "dev": { "cache": false, "persistent": true },
    "test": { "cache": false, "persistent": true }
  }
}
```

### 2. Core Architecture (@getvision/core)

The `@getvision/core` package is the foundation, providing:

#### **Tracing System**
- **TraceStore:** In-memory circular buffer for traces (configurable max size)
- **Tracer:** Creates and manages spans with parent-child relationships
- **Context:** AsyncLocalStorage-based context propagation
- **Spans:** Hierarchical timing and metadata collection

```typescript
// Trace lifecycle
const trace = vision.createTrace('GET', '/users')
const span = tracer.startSpan('http.request', trace.id)
// ... request processing ...
tracer.endSpan(span.id)
vision.completeTrace(trace.id, 200, duration)
```

#### **Validation System (UniversalValidator)**
Abstraction layer supporting multiple validation libraries:

- **Zod:** Detected via `_def` and `parse` properties
- **Valibot:** Detected via `type` and `~run`/`~standard` properties
- **Standard Schema v1:** Direct support

```typescript
// Works with any library
const validated = UniversalValidator.parse(schema, data)
const result = UniversalValidator.validate(schema, data)
const standardSchema = UniversalValidator.toStandardSchema(schema)
```

#### **WebSocket Server (JSON-RPC 2.0)**
Real-time communication with dashboard:

**Methods (request/response):**
- `status` - Get application status
- `traces/list` - List traces with filters
- `traces/get` - Get specific trace details
- `traces/clear` - Clear all traces
- `routes/list` - Get registered routes
- `services/list` - Get grouped services
- `logs/list` - Get logs with filters

**Notifications (one-way):**
- `trace.new` - Broadcast new completed trace
- `log.entry` - Broadcast new log entry
- `app.started` - Application status changed

#### **Template Generator**
Automatically generates request templates from validation schemas:

```typescript
// Input: Zod/Valibot schema
const schema = z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number().optional()
})

// Output: JSONC template with field metadata
{
  "template": "{\n  \"name\": \"\", // string (required)\n  \"email\": \"\", // string (required)\n  \"age\": 0 // number (optional)\n}",
  "fields": [
    { "name": "name", "type": "string", "required": true },
    { "name": "email", "type": "string", "required": true },
    { "name": "age", "type": "number", "required": false }
  ]
}
```

#### **Console Interceptor**
Captures all console output and associates with active trace:

```typescript
// Automatically captures and links to current trace
console.log('Processing user request')  // Linked to trace
console.error('Database error', { userId: 123 })  // Linked with context
```

### 3. Adapter Pattern

All framework adapters follow a consistent pattern:

1. **Middleware/Plugin registration** - Inject Vision
2. **Request interception** - Create trace at request start
3. **Context propagation** - AsyncLocalStorage for trace context
4. **Response capture** - Intercept response to capture metadata
5. **Trace completion** - End span and broadcast to dashboard

**Key differences by framework:**

| Framework | Integration Type | Context Storage | Route Discovery |
|-----------|-----------------|-----------------|-----------------|
| Express   | Middleware      | AsyncLocalStorage | `app._router.stack` introspection |
| Fastify   | Plugin          | `@fastify/request-context` | `onRoute` hook |
| Hono      | Middleware      | AsyncLocalStorage | Method patching |

### 4. "Wide Events" Logging Philosophy

Vision implements **"Wide Events"** - add context once, see it everywhere:

```typescript
// Add context to current trace
const { vision } = getVisionContext()
vision.addContext({
  'user.id': userId,
  'user.plan': 'pro',
  'feature.enabled': true
})

// All subsequent logs in this trace include this context automatically
console.log('User action')  // Has user.id, user.plan, feature.enabled
```

### 5. Service Detection & Auto-Discovery

Vision automatically detects:
- **Routes:** All registered HTTP endpoints
- **Services:** Grouping by path prefix (e.g., `/users/*` → "Users" service)
- **Integrations:** Drizzle ORM, validation libraries
- **Package info:** From `package.json`

---

## Code Conventions

### TypeScript Conventions

#### **Strict Type Safety**
```typescript
// tsconfig.json (all packages extend @repo/typescript-config/base.json)
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "strictFunctionTypes": true,
  "strictPropertyInitialization": true
}
```

#### **Naming Conventions**
- **Functions:** `camelCase` (e.g., `createTrace`, `generateTemplate`)
- **Classes:** `PascalCase` (e.g., `VisionCore`, `UniversalValidator`)
- **Interfaces:** `PascalCase` (e.g., `RouteMetadata`, `ValidationSchema`)
- **Types:** `PascalCase` (e.g., `DashboardEvent`, `LogLevel`)
- **Constants:** `SCREAMING_SNAKE_CASE` (e.g., `MAX_TRACES`, `DEFAULT_PORT`)
- **Private methods:** Prefix with underscore or use `private` keyword

#### **Type Patterns**

**Discriminated Unions:**
```typescript
export type DashboardEvent =
  | { type: 'app.started'; data: AppStatus }
  | { type: 'trace.new'; data: Trace }
  | { type: 'log.entry'; data: LogEntry }
```

**Generic Constraints:**
```typescript
export function validator<S extends ZodTypeAny>(
  target: 'body',
  schema: S
): RequestHandler<any, any, import('zod').infer<S>, any>
```

**Type Guards:**
```typescript
export function isZodSchema(obj: any): obj is z.ZodType {
  return obj && typeof obj === "object" && "_def" in obj && "parse" in obj
}
```

#### **Module System**
- **Type:** ES Modules (ESM) only - `"type": "module"` in all `package.json`
- **Imports:** Use `import`/`export`, never `require()`
- **Extensions:** Omit `.js`/`.ts` in imports (handled by module resolution)
- **Resolution:** `"moduleResolution": "Bundler"`

#### **Export Patterns**

**Package exports (multiple entry points for tree-shaking):**
```json
{
  "exports": {
    ".": "./dist/index.js",
    "./validation": "./dist/validation/index.js",
    "./tracing": "./dist/tracing/index.js"
  }
}
```

**Index exports (re-export public API):**
```typescript
// packages/core/src/index.ts
export { VisionCore } from './core'
export { VisionWebSocketServer } from './server/index'
export * from './tracing/index'
export * from './validation/index'
```

### Error Handling

#### **Standardized Error Responses**
```typescript
interface ValidationErrorResponse {
  error: {
    code: 'VALIDATION_ERROR'
    message: string
    details: {
      field: string
      message: string
      path: readonly (string | number)[]
    }[]
  }
  timestamp: string
  requestId?: string
}
```

#### **Graceful Degradation**
```typescript
// Prefer fallbacks over throwing errors in non-critical paths
try {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  return { name: pkg.name || 'unknown', version: pkg.version || '0.0.0' }
} catch (error) {
  // Graceful fallback, no throw
  return { name: 'unknown', version: '0.0.0' }
}
```

### Code Style

#### **Formatting**
- **Tool:** Prettier (config in `.prettierrc` if exists, or defaults)
- **Command:** `bun run format`
- **Pre-commit:** Format before committing (recommended)

#### **Linting**
- **Tool:** ESLint with TypeScript support
- **Config:** `@repo/eslint-config`
- **Command:** `bun run lint`
- **CI:** Max warnings = 0

#### **Comments**
- **JSDoc:** Use for public APIs, exported functions, and complex logic
- **Inline:** Use sparingly, prefer self-documenting code
- **TODOs:** Format as `// TODO: description` or `// FIXME: description`

```typescript
/**
 * Creates a new trace for an HTTP request.
 *
 * @param method - HTTP method (GET, POST, etc.)
 * @param path - Request path
 * @param metadata - Optional additional metadata
 * @returns The created trace object
 */
export function createTrace(
  method: string,
  path: string,
  metadata?: Record<string, unknown>
): Trace {
  // Implementation
}
```

---

## Development Workflows

### Git Workflow

#### **Branch Strategy**
- **Main branch:** `main` (protected)
- **Feature branches:** `feat/feature-name` or `fix/bug-name`
- **Release branches:** `release/vX.Y.Z`

#### **Commit Conventions**

Vision follows **Conventional Commits** specification (enforced via commitlint):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `chore:` - Maintenance tasks
- `refactor:` - Code refactoring (no feature change)
- `test:` - Adding/updating tests
- `perf:` - Performance improvements
- `ci:` - CI/CD changes

**Scopes (optional):**
- `core` - Changes to @getvision/core
- `server` - Changes to @getvision/server
- `adapter-express` - Changes to Express adapter
- `adapter-fastify` - Changes to Fastify adapter
- `adapter-hono` - Changes to Hono adapter
- `docs` - Documentation site changes

**Examples:**
```bash
feat(adapter-hono): add query parameter tracking
fix(core): resolve trace completion race condition
docs: update validation library examples
chore: bump dependency versions
```

#### **Git Hooks**
- **Commitlint:** Validates commit messages on commit
- **Pre-commit:** Run linting/formatting (if configured)

### Versioning & Changesets

Vision uses **Changesets** for versioning and changelog generation.

#### **Creating a Changeset**

```bash
# After making changes, create a changeset
bun run changeset

# Follow prompts:
# 1. Select packages that changed (space to select, enter to confirm)
# 2. Select version bump type (major/minor/patch)
# 3. Write a summary of changes
```

**Changeset file example (`.changeset/cool-pandas-smile.md`):**
```md
---
"@getvision/core": minor
"@getvision/adapter-express": patch
---

Add support for custom trace metadata and fix Express middleware ordering
```

#### **Version Bump Guidelines**

Follow **Semantic Versioning (SemVer)**:

- **Major (X.0.0):** Breaking changes, incompatible API changes
- **Minor (0.X.0):** New features, backward-compatible additions
- **Patch (0.0.X):** Bug fixes, backward-compatible fixes

#### **Release Process**

1. **Create changesets** for all changes
2. **CI automatically versions** packages on merge to `main`
3. **CI publishes** to npm with appropriate tags:
   - `main` branch → `@next` tag
   - `release/*` branch → `@latest` tag

### CI/CD Pipeline

**Workflow (`.github/workflows/ci.yml`):**

1. **Commitlint:** Validates commit messages (PRs only)
2. **Build & Test:**
   - Setup Bun 1.3.0
   - Install dependencies with frozen lockfile
   - Build all packages (Turbo)
   - Run all tests (Turbo)
3. **Release:**
   - Create/update changeset PR
   - Version packages
   - Update CHANGELOGs
4. **Publish:**
   - Publish changed packages to npm
   - Tag based on branch (`@next` or `@latest`)

**Caching:**
- Bun install cache: `~/.bun/install/cache`
- Turborepo cache: `.turbo`

---

## Testing Guidelines

### Test Framework

Vision uses **Bun Test** - fast, built-in test runner:

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
```

### Test Organization

Tests are co-located with source code in `__tests__` directories:

```
packages/core/src/
  __tests__/
    core.test.ts
    tracing.test.ts
  validation/
    __tests__/
      validator.test.ts
```

### Test Patterns

#### **Unit Tests**
```typescript
describe('VisionCore', () => {
  test('should create and complete trace', () => {
    const vision = new VisionCore({
      port: 0,  // Disable WebSocket server
      maxTraces: 100,
      captureConsole: false
    })

    const trace = vision.createTrace('GET', '/test')
    expect(trace).toBeDefined()
    expect(trace.id).toBeDefined()

    vision.completeTrace(trace.id, 200, 50)
    const retrieved = vision.getTraceStore().getTrace(trace.id)
    expect(retrieved?.statusCode).toBe(200)
    expect(retrieved?.duration).toBe(50)
  })
})
```

#### **Testing with Multiple Libraries**
```typescript
describe('UniversalValidator', () => {
  const zodSchema = z.object({ name: z.string() })
  const valibotSchema = v.object({ name: v.string() })

  test('validates with Zod schema', () => {
    const result = UniversalValidator.validate(zodSchema, { name: 'test' })
    expect(result.issues).toBeUndefined()
    expect(result.value).toEqual({ name: 'test' })
  })

  test('validates with Valibot schema', () => {
    const result = UniversalValidator.validate(valibotSchema, { name: 'test' })
    expect(result.issues).toBeUndefined()
  })
})
```

#### **Error Testing**
```typescript
test('should handle validation errors', () => {
  expect(() => {
    UniversalValidator.parse(schema, invalidData)
  }).toThrow()
})

test('should capture error in span', () => {
  const withSpan = vision.createSpanHelper(trace.id)

  expect(() => {
    withSpan('test.error', {}, () => {
      throw new Error('Test error')
    })
  }).toThrow('Test error')

  const span = vision.getTraceStore().getTrace(trace.id)?.spans[0]
  expect(span?.attributes?.error).toBe(true)
  expect(span?.attributes?.['error.message']).toBe('Test error')
})
```

### Running Tests

```bash
# Run all tests
bun run test

# Run tests in watch mode
bun test --watch

# Run tests for specific package
cd packages/core
bun test

# Run specific test file
bun test src/__tests__/core.test.ts
```

### Test Coverage (Future)

Currently no coverage tooling configured. Consider adding:
```bash
# Future: bun test --coverage
```

---

## Common Tasks

### Adding a New Package

1. **Create package directory:**
```bash
mkdir -p packages/my-package/src
cd packages/my-package
```

2. **Create `package.json`:**
```json
{
  "name": "@getvision/my-package",
  "version": "0.0.1",
  "type": "module",
  "types": "dist/index.d.ts",
  "module": "dist/index.js",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "dev": "tsc --watch",
    "build": "tsc",
    "test": "bun test",
    "lint": "eslint . --max-warnings 0"
  },
  "dependencies": {
    "@getvision/core": "workspace:*"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "@types/node": "^20.14.9",
    "typescript": "5.9.3"
  }
}
```

3. **Create `tsconfig.json`:**
```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

4. **Install dependencies:**
```bash
bun install
```

### Adding a New Framework Adapter

1. **Create adapter package** (see "Adding a New Package" above)

2. **Implement adapter following existing patterns:**
   - Study `packages/adapter-express` or `packages/adapter-hono`
   - Implement middleware/plugin integration
   - Add route auto-discovery
   - Add validation middleware/hook
   - Add context helpers (`useVisionSpan`, `getVisionContext`)

3. **Create example:**
```bash
mkdir -p examples/my-framework
# Add package.json, src/index.ts with example usage
```

4. **Add example script to root `package.json`:**
```json
{
  "scripts": {
    "example:my-framework": "bun --filter my-framework-example dev"
  }
}
```

5. **Document in README and CONTRIBUTING.md**

### Modifying Core Functionality

1. **Read existing code** in `packages/core/src`
2. **Add tests first** (TDD approach recommended)
3. **Implement changes**
4. **Update types** if public API changes
5. **Run tests:** `bun test`
6. **Create changeset:** `bun run changeset`

### Adding Dependencies

#### **Production Dependencies**
```bash
# In specific package
cd packages/core
bun add my-dependency

# Or from root
bun add my-dependency --filter @getvision/core
```

#### **Dev Dependencies**
```bash
bun add -D my-dev-dependency --filter @getvision/core
```

#### **Peer Dependencies**
For optional integrations (like Zod, Valibot):

```json
{
  "peerDependencies": {
    "zod": "^3.0.0 || ^4.0.0"
  },
  "peerDependenciesMeta": {
    "zod": {
      "optional": true
    }
  }
}
```

### Updating Documentation

#### **README Files**
- Update package-specific READMEs in each package
- Update root README.md for overall project changes

#### **CHANGELOG Files**
- Don't manually edit CHANGELOGs
- Changesets automatically generates them

#### **Documentation Site (`apps/docs`)**
- Located in `apps/docs`
- Run: `bun docs:dev`
- Build: `bun docs:build`

---

## Package-Specific Notes

### @getvision/core

**Key files:**
- `src/core.ts` - Main VisionCore class
- `src/tracing/` - Tracing system (TraceStore, Tracer, context)
- `src/validation/` - Universal validation (UniversalValidator, adapters)
- `src/server/` - WebSocket server, JSON-RPC handler
- `src/utils/` - Utilities (template generator, service detector)

**Special build step:**
```bash
# Builds UI and copies to dist/ui/
bun run build
```

**Dependencies:**
- `ws` - WebSocket server
- `nanoid` - ID generation
- `mime-types` - MIME type detection

**Peer dependencies:**
- `zod` (optional)
- `valibot` (optional)

### @getvision/server

**Purpose:** Meta-framework built on Hono with built-in observability

**Key features:**
- Service builder pattern
- Event bus (BullMQ)
- Cron jobs (BullMQ repeatable jobs)
- Built-in Vision integration

**Dependencies:**
- `hono` - Base framework
- `@hono/node-server` - Node.js adapter
- `bullmq` - Job queue and event bus
- `ioredis` - Redis client
- `zod` - Validation (required for server)

**Note:** Exports TypeScript source (`exports: "./src/index.ts"`), not compiled

### @getvision/adapter-express

**Integration:** Middleware-based

**Key functions:**
- `visionMiddleware(options)` - Main middleware
- `enableAutoDiscovery(app, options?)` - Route discovery
- `validator(target, schema)` - Validation middleware
- `useVisionSpan()` - Create custom spans
- `getVisionContext()` - Access Vision context

**Peer dependencies:**
- `express` (^4.18.0)

### @getvision/adapter-fastify

**Integration:** Plugin-based

**Key functions:**
- `visionPlugin(fastify, options)` - Fastify plugin
- `enableAutoDiscovery(fastify, options?)` - Route discovery
- `validator(target, schema)` - Validation preHandler
- `useVisionSpan(request)` - Create custom spans
- `getVisionContext(request)` - Access Vision context

**Dependencies:**
- `fastify-plugin` - Plugin wrapper
- `@fastify/request-context` - Request context

**Peer dependencies:**
- `fastify` (^4.0.0)

### @getvision/adapter-hono

**Integration:** Middleware-based

**Key features:**
- Route patching for auto-discovery
- Drizzle Studio auto-start support

**Key functions:**
- `visionAdapter(options)` - Middleware
- `enableAutoDiscovery(app, options?)` - Route discovery (with patching)
- `validator(target, schema)` - Validation middleware
- `useVisionSpan()` - Create custom spans
- `getVisionContext()` - Access Vision context

**Peer dependencies:**
- `hono` (^4.0.0)

---

## Troubleshooting

### Build Issues

#### **TypeScript errors after pulling changes**
```bash
# Clean and rebuild
rm -rf packages/*/dist apps/*/dist examples/*/dist
bun run build
```

#### **Module resolution errors**
- Ensure `moduleResolution: "Bundler"` in tsconfig
- Check `package.json` exports are correct
- Verify workspace dependencies use `workspace:*`

### Test Issues

#### **Tests failing after dependency update**
```bash
# Clear Bun cache and reinstall
rm -rf node_modules bun.lock
bun install
bun run test
```

#### **AsyncLocalStorage context not available**
- Ensure middleware is registered before routes
- Check context is accessed within request handler scope
- Verify AsyncLocalStorage is properly initialized

### Runtime Issues

#### **WebSocket connection fails**
- Check port is not in use
- Verify firewall allows WebSocket connections
- Ensure `port: 0` to disable server in tests

#### **Validation errors not showing**
- Verify validation middleware is registered
- Check schema is valid Zod/Valibot schema
- Ensure error handler is not swallowing errors

#### **Traces not appearing in dashboard**
- Verify Vision is initialized with `port` option
- Check WebSocket connection in browser DevTools
- Ensure `captureConsole: true` if needed
- Check trace is completed (`completeTrace()` called)

### Development Workflow Issues

#### **Turbo cache issues**
```bash
# Clear Turbo cache
rm -rf .turbo
bun run build
```

#### **Hot reload not working**
```bash
# Restart dev server
# Kill process (Ctrl+C) and restart
bun run dev
```

#### **Changeset not recognized**
- Ensure changeset file is in `.changeset/` directory
- Verify frontmatter format is correct
- Check package names match exactly

---

## Best Practices for AI Assistants

### When Reading Code

1. **Start with package.json** to understand dependencies and scripts
2. **Read README** for package-specific context
3. **Check types/index.ts** for public API surface
4. **Look for __tests__** to understand expected behavior
5. **Follow imports** to understand module structure

### When Writing Code

1. **Maintain type safety** - no `any` unless absolutely necessary
2. **Add tests** for new functionality
3. **Update types** if public API changes
4. **Create changeset** for user-facing changes
5. **Follow existing patterns** - study similar code first
6. **Document complex logic** with JSDoc comments
7. **Handle errors gracefully** - prefer fallbacks over throws

### When Modifying Packages

1. **Check dependents** - who depends on this package?
2. **Avoid breaking changes** - or document clearly in changeset
3. **Update exports** if adding new public APIs
4. **Run tests** in dependent packages after changes
5. **Consider backward compatibility**

### When Adding Features

1. **Discuss architecture** before implementing large features
2. **Start with types** - define interfaces first
3. **Add tests** before implementation (TDD)
4. **Update documentation** alongside code
5. **Create example** if adding adapter or major feature

### When Fixing Bugs

1. **Add failing test** that reproduces the bug
2. **Fix the bug** to make test pass
3. **Check for similar issues** in related code
4. **Create changeset** with clear description
5. **Consider root cause** - is this a symptom of larger issue?

---

## Additional Resources

### Documentation
- **Main Docs:** https://getvision.dev/docs
- **Contributing Guide:** `/CONTRIBUTING.md`
- **README:** `/README.md`

### External Documentation
- **Turborepo:** https://turbo.build/repo/docs
- **Bun:** https://bun.sh/docs
- **TypeScript:** https://www.typescriptlang.org/docs
- **Changesets:** https://github.com/changesets/changesets
- **Conventional Commits:** https://www.conventionalcommits.org

### Community
- **GitHub Issues:** https://github.com/ephor/vision/issues
- **Discussions:** https://github.com/ephor/vision/discussions

---

## Changelog

### 2026-01-24
- Initial creation of CLAUDE.md
- Comprehensive documentation of architecture, conventions, and workflows
- Added package-specific notes for all core packages
- Documented testing, CI/CD, and troubleshooting guidelines

---

**Note for AI Assistants:** This document is maintained to provide comprehensive context for AI assistants working with this codebase. When making significant architectural changes, update this document accordingly and create a changeset noting the documentation update.
