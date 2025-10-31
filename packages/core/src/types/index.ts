/**
 * Core types for Vision Dashboard
 */

// JSON-RPC 2.0 Protocol
export interface JsonRpcRequest {
  jsonrpc: '2.0'
  method: string
  params?: unknown
  id?: string | number
}

export interface JsonRpcResponse {
  jsonrpc: '2.0'
  result?: unknown
  error?: JsonRpcError
  id: string | number | null
}

export interface JsonRpcError {
  code: number
  message: string
  data?: unknown
}

export interface JsonRpcNotification {
  jsonrpc: '2.0'
  method: string
  params?: unknown
}

// Trace types
export interface Trace {
  id: string
  timestamp: number
  method: string
  path: string
  statusCode?: number
  duration?: number
  spans: Span[]
  metadata?: Record<string, unknown>
}

export interface Span {
  id: string
  traceId: string
  parentId?: string
  name: string
  startTime: number
  endTime?: number
  duration?: number
  attributes?: Record<string, unknown>
  events?: SpanEvent[]
}

export interface SpanEvent {
  name: string
  timestamp: number
  attributes?: Record<string, unknown>
}

// App status types
export interface AppStatus {
  name?: string
  version?: string
  description?: string
  environment?: string
  running: boolean
  pid?: number
  uptime?: number
  memory?: {
    heapUsed: number
    heapTotal: number
    external: number
  }
  metadata?: {
    framework?: string
    integrations?: Record<string, string>
    drizzle?: {
      detected: boolean
      configPath?: string
      studioUrl?: string
      autoStarted?: boolean
    }
    [key: string]: unknown
  }
}

// Route metadata
export interface RouteMetadata {
  method: string
  path: string
  handler: string
  middleware?: string[]
  params?: RouteParam[]
  requestBody?: RequestBodySchema
  responseBody?: RequestBodySchema  // NEW: Response schema
  response?: RouteResponse
  schema?: any // Zod schema for validation
}

export interface RequestBodySchema {
  template: string // JSON template with comments
  fields: SchemaField[]
}

export interface SchemaField {
  name: string
  type: string
  description?: string
  required: boolean
  example?: any
  nested?: SchemaField[] // For objects/arrays
}

// Service grouping
export interface ServiceGroup {
  name: string
  description?: string
  routes: RouteMetadata[]
}

export interface RouteParam {
  name: string
  type: string
  required: boolean
  description?: string
}

export interface RouteResponse {
  type: string
  description?: string
  schema?: unknown
}

// Dashboard events
export type DashboardEvent =
  | { type: 'app.started'; data: AppStatus }
  | { type: 'app.stopped'; data: { pid: number } }
  | { type: 'trace.new'; data: Trace }
  | { type: 'log.entry'; data: import('./logs').LogEntry }
  | { type: 'log.stdout'; data: { message: string; timestamp: number } }
  | { type: 'log.stderr'; data: { message: string; timestamp: number } }
  | { type: 'compile.start'; data: { timestamp: number } }
  | { type: 'compile.success'; data: { timestamp: number; duration: number } }
  | { type: 'compile.error'; data: { message: string; stack?: string } }

// Vision server options
export interface VisionServerOptions {
  port?: number
  host?: string
  maxTraces?: number
  maxLogs?: number
  captureConsole?: boolean
  enableCors?: boolean
}

// Adapter interface
export interface VisionAdapter {
  name: string
  version: string
  getRoutes(): RouteMetadata[]
  onRequest(handler: RequestHandler): void
  onResponse(handler: ResponseHandler): void
}

export type RequestHandler = (req: AdapterRequest) => void | Promise<void>
export type ResponseHandler = (req: AdapterRequest, res: AdapterResponse) => void | Promise<void>

export interface AdapterRequest {
  method: string
  path: string
  headers: Record<string, string>
  query?: Record<string, string>
  body?: unknown
  timestamp: number
}

export interface AdapterResponse {
  statusCode: number
  headers: Record<string, string>
  body?: unknown
  duration: number
}

export * from './logs'
export * from './adapter-options'
