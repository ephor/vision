# @getvision/core

Core package for Vision Dashboard - WebSocket server, JSON-RPC protocol, and distributed tracing engine.

## Features

- ✅ **WebSocket Server** - Real-time bidirectional communication
- ✅ **JSON-RPC 2.0** - Standard protocol for method calls
- ✅ **Distributed Tracing** - Trace storage and span management
- ✅ **Event Broadcasting** - Push events to all connected clients
- ✅ **Type-safe** - Full TypeScript support

## Installation

```bash
pnpm add @getvision/core
```

## Usage

```typescript
import { VisionCore } from '@getvision/core'

// Create Vision instance
const vision = new VisionCore({
  port: 9500,
  maxTraces: 1000,
})

// Set app status
vision.setAppStatus({
  running: true,
  pid: process.pid,
  metadata: {
    name: 'My App',
    framework: 'hono',
  },
})

// Create and complete traces
const trace = vision.createTrace('GET', '/api/users')
// ... handle request ...
vision.completeTrace(trace.id, 200, 150)

// Broadcast events
vision.broadcast({
  type: 'log.stdout',
  data: { message: 'Server started', timestamp: Date.now() },
})
```

## API

### VisionCore

Main orchestrator class.

#### Constructor

```typescript
new VisionCore(options?: VisionServerOptions)
```

#### Methods

- `setAppStatus(status: Partial<AppStatus>)` - Update app status
- `createTrace(method: string, path: string): Trace` - Create new trace
- `completeTrace(traceId: string, statusCode: number, duration: number)` - Complete trace
- `broadcast(event: DashboardEvent)` - Broadcast event to clients
- `getTracer(): Tracer` - Get tracer instance
- `getClientCount(): number` - Get connected client count
- `close(): Promise<void>` - Close server

### TraceStore

In-memory trace storage with automatic cleanup.

### Tracer

Span creation and management for distributed tracing.

## JSON-RPC Methods

Built-in methods available via WebSocket:

- `status` - Get app status
- `traces/list` - List all traces
- `traces/get` - Get specific trace
- `traces/clear` - Clear all traces
- `routes/list` - Get registered routes
- `version` - Get Vision version

## Events

Events broadcast to connected clients:

- `app.started` - App started
- `app.stopped` - App stopped
- `trace.new` - New trace created
- `log.stdout` - stdout message
- `log.stderr` - stderr message
- `compile.start` - Compilation started
- `compile.success` - Compilation succeeded
- `compile.error` - Compilation failed
