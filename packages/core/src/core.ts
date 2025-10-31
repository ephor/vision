import { VisionWebSocketServer } from './server'
import { TraceStore, Tracer } from './tracing'
import { LogStore } from './logs/store'
import { ConsoleInterceptor } from './logs/interceptor'
import type {
  VisionServerOptions,
  AppStatus,
  RouteMetadata,
  ServiceGroup,
  Trace,
  DashboardEvent,
  LogLevel,
  LogEntry,
} from './types/index'

/**
 * VisionCore - Main orchestrator for the Vision Dashboard
 */
export class VisionCore {
  private server: VisionWebSocketServer
  private traceStore: TraceStore
  private tracer: Tracer
  private logStore: LogStore
  private consoleInterceptor?: ConsoleInterceptor
  private routes: RouteMetadata[] = []
  private services: ServiceGroup[] = []
  private appStatus: AppStatus = {
    name: 'Unknown',
    version: '0.0.0',
    environment: 'development',
    running: false,
  }

  constructor(options: VisionServerOptions = {}) {
    this.server = new VisionWebSocketServer(options)
    this.traceStore = new TraceStore(options.maxTraces)
    this.tracer = new Tracer()
    this.logStore = new LogStore(options.maxLogs)
    
    // Optional console intercept
    if (options.captureConsole !== false) {
      this.consoleInterceptor = new ConsoleInterceptor(
        this.logStore,
        () => {
          // Broadcast latest log entry to connected clients
          this.broadcast({ 
            type: 'log.entry', 
            data: this.logStore.getLogs({ limit: 1 })[0] 
          })
        }
      )
      this.consoleInterceptor.start()
    }

    this.registerMethods()
  }

  /**
   * Register all JSON-RPC methods
   */
  private registerMethods(): void {
    // App status
    this.server.registerMethod('status', async () => {
      return this.appStatus
    })

    // List all traces
    this.server.registerMethod('traces/list', async (params: any) => {
      return this.traceStore.getTraces({
        method: params?.method,
        statusCode: params?.statusCode,
        minDuration: params?.minDuration,
        limit: params?.limit ?? 100,
      })
    })

    // Get specific trace
    this.server.registerMethod('traces/get', async (params: any) => {
      if (!params?.traceId) {
        throw new Error('traceId is required')
      }
      return this.traceStore.getTrace(params.traceId)
    })

    // Clear traces
    this.server.registerMethod('traces/clear', async () => {
      this.traceStore.clear()
      return { success: true }
    })

    // Export traces
    this.server.registerMethod('traces/export', async (params: any) => {
      const format = (params as any)?.format || 'json'
      const traces = this.traceStore.getAllTraces()
      
      if (format === 'ndjson') {
        return traces.map(t => JSON.stringify(t)).join('\n')
      }
      
      return JSON.stringify(traces, null, 2)
    })

    // Get routes
    this.server.registerMethod('routes/list', async () => {
      return this.routes
    })

    // Get services (grouped routes)
    this.server.registerMethod('services/list', async () => {
      return this.services
    })

    // Get version
    this.server.registerMethod('version', async () => {
      return {
        version: '0.0.1',
        name: 'Vision Dashboard',
      }
    })

    // Logs methods
    this.server.registerMethod('logs/list', async (params: any) => {
      return this.logStore.getLogs({
        level: params?.level,
        search: params?.search,
        limit: params?.limit ?? 100,
        since: params?.since,
      })
    })

    this.server.registerMethod('logs/clear', async () => {
      this.logStore.clear()
      return { success: true }
    })

    this.server.registerMethod('traces/addClientMetrics', async (params) => {
      const { traceId, clientDuration } = params as { traceId: string; clientDuration: number }
      if (!traceId || typeof clientDuration !== 'number') {
        throw new Error('traceId and clientDuration are required')
      }
      
      const trace = this.traceStore.getTrace(traceId)
      if (trace) {
        trace.metadata = { ...(trace.metadata || {}), clientDuration }
      }
      
      return { success: true }
    })
  }

  /**
   * Update app status
   */
  setAppStatus(status: Partial<AppStatus>): void {
    this.appStatus = { ...this.appStatus, ...status }
    this.broadcast({ type: 'app.started', data: this.appStatus })
  }

  /**
   * Register routes from adapter
   */
  registerRoutes(routes: RouteMetadata[]): void {
    this.routes = routes
  }

  /**
   * Register grouped services
   */
  registerServices(services: ServiceGroup[]): void {
    this.services = services
  }

  /**
   * Create a new trace
   */
  createTrace(method: string, path: string): Trace {
    const trace = this.traceStore.createTrace(method, path)
    return trace
  }

  /**
   * Complete a trace
   */
  completeTrace(traceId: string, statusCode: number, duration: number): void {
    this.traceStore.completeTrace(traceId, statusCode, duration)
    const trace = this.traceStore.getTrace(traceId)
    
    if (trace) {
      this.broadcast({ type: 'trace.new', data: trace })
    }
  }

  /**
   * Get tracer instance
   */
  getTracer(): Tracer {
    return this.tracer
  }

  /**
   * Get WebSocket server instance (for registering JSON-RPC methods)
   */
  getServer(): VisionWebSocketServer {
    return this.server
  }

  /**
   * Create a span helper for easy span creation
   * @param traceId - Trace ID to attach spans to
   * @returns A function that creates spans with automatic error handling
   * 
   * @example
   * ```ts
   * const withSpan = vision.createSpanHelper(traceId)
   * 
   * const user = withSpan('db.select', { 'db.system': 'sqlite' }, () => {
   *   return db.select().from(users).get()
   * })
   * ```
   */
  createSpanHelper(traceId: string) {
    return <T>(
      name: string,
      attributes: Record<string, any> = {},
      fn: () => T
    ): T => {
      const span = this.tracer.startSpan(name, traceId)

      // Add attributes
      for (const [key, value] of Object.entries(attributes)) {
        this.tracer.setAttribute(span.id, key, value)
      }

      try {
        const result = fn()
        const completedSpan = this.tracer.endSpan(span.id)
        
        // Add span to trace store
        if (completedSpan) {
          this.traceStore.addSpan(traceId, completedSpan)
        }
        
        return result
      } catch (error) {
        this.tracer.setAttribute(span.id, 'error', true)
        this.tracer.setAttribute(
          span.id,
          'error.message',
          error instanceof Error ? error.message : String(error)
        )
        const completedSpan = this.tracer.endSpan(span.id)
        
        // Add span to trace store even on error
        if (completedSpan) {
          this.traceStore.addSpan(traceId, completedSpan)
        }
        
        throw error
      }
    }
  }

  /**
   * Get trace store
   */
  getTraceStore(): TraceStore {
    return this.traceStore
  }

  /**
   * Universal log API - can be called by any logger
   */
  log(level: LogLevel, message: string, meta?: Record<string, any>): LogEntry {
    const args = meta ? [meta] : undefined
    const entry = this.logStore.addLog(level, message, args)
    
    // Broadcast to connected clients
    this.broadcast({ type: 'log.entry', data: entry })
    
    return entry
  }

  /**
   * Get log store instance
   */
  getLogStore(): LogStore {
    return this.logStore
  }

  /**
   * Broadcast event to all connected clients
   */
  broadcast(event: DashboardEvent): void {
    this.server.broadcast(event)
  }

  /**
   * Log stdout message
   */
  logStdout(message: string): void {
    this.broadcast({
      type: 'log.stdout',
      data: { message, timestamp: Date.now() },
    })
  }

  /**
   * Log stderr message
   */
  logStderr(message: string): void {
    this.broadcast({
      type: 'log.stderr',
      data: { message, timestamp: Date.now() },
    })
  }

  /**
   * Get number of connected dashboard clients
   */
  getClientCount(): number {
    return this.server.getClientCount()
  }

  /**
   * Close the Vision server
   */
  async close(): Promise<void> {
    await this.server.close()
  }
}
