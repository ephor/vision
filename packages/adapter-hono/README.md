# @getvision/adapter-hono

Hono.js adapter for Vision Dashboard.

## Installation

```bash
pnpm add @getvision/adapter-hono
```

## Usage

### Option 1: Auto-discovery (Recommended) ✨

Routes are automatically discovered - no manual registration needed!

```typescript
import { Hono } from 'hono'
import { visionAdapter, enableAutoDiscovery } from '@getvision/adapter-hono'

const app = new Hono()

// Add Vision Dashboard (development only)
if (process.env.NODE_ENV !== 'production') {
  app.use('*', visionAdapter({
    port: 9500,
    enabled: true,
  }))
  
  // Enable auto-discovery
  enableAutoDiscovery(app)
}

// Your routes - automatically registered!
app.get('/hello', (c) => c.json({ hello: 'world' }))
app.post('/users', (c) => c.json({ success: true }))

export default app
```

### Option 2: Manual Registration

If you prefer explicit control:

```typescript
import { Hono } from 'hono'
import { visionAdapter, registerRoutes } from '@getvision/adapter-hono'

const app = new Hono()

if (process.env.NODE_ENV !== 'production') {
  app.use('*', visionAdapter({ port: 9500 }))
}

app.get('/hello', (c) => c.json({ hello: 'world' }))
app.post('/users', (c) => c.json({ success: true }))

// Manually register routes
if (process.env.NODE_ENV !== 'production') {
  registerRoutes([
    { method: 'GET', path: '/hello', handler: 'hello' },
    { method: 'POST', path: '/users', handler: 'createUser' },
  ])
}

export default app
```

## Options

```typescript
interface VisionHonoOptions {
  port?: number        // Dashboard port (default: 9500)
  enabled?: boolean    // Enable/disable adapter (default: true)
  maxTraces?: number   // Max traces to store (default: 1000)
}
```

## Features

- ✅ **Automatic request tracing** - Every request is traced
- ✅ **Error tracking** - Exceptions are captured in traces
- ✅ **Query params** - Automatically logged
- ✅ **Response status** - Tracked in spans
- ✅ **Zero config** - Just add middleware and go!

## How it works

The adapter:

1. Starts Vision WebSocket server on specified port
2. Wraps each request in a trace
3. Creates spans with timing information
4. Captures errors and attributes
5. Broadcasts traces to dashboard in real-time

## Dashboard

Once running, open `http://localhost:9500` to see:

- Real-time request traces
- Request/response details
- Error tracking
- Performance metrics

## Example

See [examples/hono-basic](../../examples/hono) for a complete example.
