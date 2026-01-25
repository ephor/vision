/**
 * Unified adapter options and types
 */

/**
 * Service configuration
 */
export interface ServiceConfig {
  name?: string
  version?: string
  description?: string
  integrations?: IntegrationConfig
}

/**
 * Integration configuration
 */
export interface IntegrationConfig {
  database?: string
  redis?: string
  [key: string]: string | undefined
}

/**
 * Drizzle Studio configuration
 */
export interface DrizzleConfig {
  autoStart?: boolean // Auto-start Drizzle Studio
  port?: number // Default: 4983
}

/**
 * Client code generation configuration
 */
export interface ClientCodegenConfig {
  /**
   * Output file path for generated client
   * @example './src/api/generated.ts'
   */
  output: string

  /**
   * Base URL for API (optional, can be set at runtime)
   */
  baseUrl?: string

  /**
   * Watch mode - regenerate on route changes (default: true in dev)
   */
  watch?: boolean

  /**
   * Include runtime validation with Zod (default: true)
   */
  includeValidation?: boolean

  /**
   * Framework for generated code (default: 'react-query')
   */
  framework?: 'react-query' | 'vanilla'
}

/**
 * Service definition for manual grouping
 */
export interface ServiceDefinition {
  name: string
  description?: string
  routes: string[] // glob patterns like '/users/*', '/auth/*'
}

/**
 * Base adapter options (common to all adapters)
 */
export interface BaseAdapterOptions {
  enabled?: boolean
  port?: number
  maxTraces?: number
  logging?: boolean
  apiUrl?: string // URL of the API server for dashboard HTTP calls
  service?: ServiceConfig
  services?: ServiceDefinition[]
  drizzle?: DrizzleConfig

  /**
   * Auto-generate type-safe client (experimental)
   * @example
   * ```typescript
   * visionAdapter({
   *   client: {
   *     output: './client/generated.ts',
   *     watch: true
   *   }
   * })
   * ```
   */
  client?: ClientCodegenConfig
}

/**
 * Hono adapter options
 */
export interface VisionHonoOptions extends BaseAdapterOptions {
  name?: string
  maxTraces?: number
}

/**
 * Express adapter options
 */
export interface VisionExpressOptions extends BaseAdapterOptions {
  maxLogs?: number
  cors?: boolean // Enable CORS (default: true)
}

/**
 * Fastify adapter options
 */
export interface VisionFastifyOptions extends BaseAdapterOptions {
  maxLogs?: number
  cors?: boolean // Enable CORS (default: true)
}
