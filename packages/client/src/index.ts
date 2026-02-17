/**
 * @getvision/client
 *
 * Type-safe TanStack Query client for Vision services.
 * Generates fully-typed `queryOptions` / `mutationOptions` from your
 * `AppRouter` type — no tRPC, no code generation, no runtime schema transfer.
 *
 * @example
 * ```ts
 * // server: app.ts
 * import { Vision } from '@getvision/server'
 * import type { InferServiceEndpoints } from '@getvision/server'
 * import { z } from 'zod'
 *
 * const app = new Vision({ service: { name: 'My API' } })
 *
 * const userService = app.service('users')
 *   .endpoint('GET', '/users/:id', {
 *     input:  z.object({ id: z.string() }),
 *     output: z.object({ id: z.string(), name: z.string() }),
 *   }, async ({ id }) => fetchUser(id))
 *   .endpoint('POST', '/users', {
 *     input:  z.object({ name: z.string(), email: z.string() }),
 *     output: z.object({ id: z.string(), name: z.string(), email: z.string() }),
 *   }, async (body) => createUser(body))
 *
 * export type AppRouter = {
 *   users: InferServiceEndpoints<typeof userService>
 * }
 *
 * // client: queries.ts
 * import { createVisionClient } from '@getvision/client'
 * import type { AppRouter } from './app'
 *
 * const client = createVisionClient<AppRouter>({ baseUrl: '/api' })
 *
 * // In a React component:
 * const { data } = useQuery(
 *   client.users['GET /users/:id'].queryOptions({ id: '123' })
 * )
 * // data is typed as { id: string; name: string } | undefined
 *
 * const mutation = useMutation(client.users['POST /users'].mutationOptions())
 * mutation.mutate({ name: 'Alice', email: 'alice@example.com' })
 * ```
 */

// ============================================================================
// Type utilities
// ============================================================================

type QueryMethod = 'GET'
type MutationMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE'
type HttpMethod = QueryMethod | MutationMethod

type ExtractMethod<K extends string> = K extends `${infer M} ${string}` ? M : never
type IsQuery<K extends string> = ExtractMethod<K> extends QueryMethod ? true : false

// ============================================================================
// Public types
// ============================================================================

/** Shape of a single endpoint's input/output types in the AppRouter. */
export type EndpointDef = {
  input: Record<string, any>
  output: unknown
}

/** Maps route keys (e.g. "GET /users/:id") to their endpoint definitions. */
export type ServiceDef = Record<string, EndpointDef>

/** Maps service names to their service definitions — your AppRouter shape. */
export type RouterDef = Record<string, ServiceDef>

// ============================================================================
// TanStack Query–compatible option types
// ============================================================================

/**
 * Return type of `.queryOptions()` — compatible with TanStack Query v5
 * `useQuery` / `useSuspenseQuery` / `queryClient.fetchQuery`.
 */
export interface VisionQueryOptions<TOutput> {
  queryKey: readonly unknown[]
  queryFn: () => Promise<TOutput>
}

/**
 * Return type of `.mutationOptions()` — compatible with TanStack Query v5
 * `useMutation`.
 */
export interface VisionMutationOptions<TInput, TOutput> {
  mutationFn: (input: TInput) => Promise<TOutput>
}

// ============================================================================
// Per-endpoint client helpers
// ============================================================================

type QueryEndpointHelper<TDef extends EndpointDef> = {
  /** Returns options for TanStack Query `useQuery`. */
  queryOptions: (input: TDef['input']) => VisionQueryOptions<TDef['output']>
  /** Directly call the endpoint (bypasses query cache). */
  call: (input: TDef['input']) => Promise<TDef['output']>
}

type MutationEndpointHelper<TDef extends EndpointDef> = {
  /** Returns options for TanStack Query `useMutation`. */
  mutationOptions: () => VisionMutationOptions<TDef['input'], TDef['output']>
  /** Directly call the endpoint (bypasses mutation state). */
  call: (input: TDef['input']) => Promise<TDef['output']>
}

type EndpointHelper<K extends string, TDef extends EndpointDef> =
  IsQuery<K> extends true
    ? QueryEndpointHelper<TDef>
    : MutationEndpointHelper<TDef>

type ServiceClient<S extends ServiceDef> = {
  [K in keyof S & string]: EndpointHelper<K, S[K]>
}

/** Fully-typed router client returned by `createVisionClient`. */
export type RouterClient<R extends RouterDef> = {
  [S in keyof R & string]: ServiceClient<R[S]>
}

// ============================================================================
// Client configuration
// ============================================================================

export interface VisionClientConfig {
  /**
   * Base URL for all API requests, e.g. `'http://localhost:3000'` or `'/api'`.
   * Trailing slashes are stripped automatically.
   */
  baseUrl?: string
  /** Static headers attached to every request. */
  headers?: Record<string, string>
  /**
   * Custom `fetch` implementation.
   * Defaults to `globalThis.fetch` (works in browsers, Bun, Node 18+).
   */
  fetch?: typeof globalThis.fetch
}

// ============================================================================
// Error class
// ============================================================================

export class VisionClientError extends Error {
  constructor(
    message: string,
    /** HTTP status code returned by the server. */
    public readonly status: number,
    /** Parsed response body (JSON) or raw text if JSON parsing failed. */
    public readonly body: unknown
  ) {
    super(message)
    this.name = 'VisionClientError'
  }
}

// ============================================================================
// Runtime helpers
// ============================================================================

async function callEndpoint(
  routeKey: string,
  input: Record<string, any>,
  config: VisionClientConfig
): Promise<unknown> {
  const spaceIndex = routeKey.indexOf(' ')
  if (spaceIndex === -1) throw new Error(`Invalid route key: "${routeKey}". Expected "METHOD /path".`)

  const method = routeKey.slice(0, spaceIndex) as HttpMethod
  const path = routeKey.slice(spaceIndex + 1)
  const baseUrl = (config.baseUrl ?? '').replace(/\/$/, '')

  // Replace :param placeholders and track which input keys were consumed.
  const usedParams = new Set<string>()
  const resolvedPath = path.replace(/:([^/]+)/g, (_match, param: string) => {
    usedParams.add(param)
    const value = input[param]
    if (value === undefined) throw new Error(`Missing required path parameter ":${param}" for ${routeKey}`)
    return encodeURIComponent(String(value))
  })

  // Build the remaining (non-path-param) input.
  const remaining: Record<string, string> = {}
  for (const [key, value] of Object.entries(input ?? {})) {
    if (!usedParams.has(key) && value !== undefined && value !== null) {
      remaining[key] = String(value)
    }
  }

  let url = baseUrl + resolvedPath
  let body: string | undefined

  if (method === 'GET' || method === 'DELETE') {
    const params = new URLSearchParams(remaining)
    const search = params.toString()
    if (search) url += `?${search}`
  } else {
    const remainingRaw: Record<string, any> = {}
    for (const [key, value] of Object.entries(input ?? {})) {
      if (!usedParams.has(key) && value !== undefined && value !== null) {
        remainingRaw[key] = value
      }
    }
    if (Object.keys(remainingRaw).length > 0) {
      body = JSON.stringify(remainingRaw)
    }
  }

  const fetchFn = config.fetch ?? globalThis.fetch
  const response = await fetchFn(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...config.headers,
    },
    ...(body !== undefined ? { body } : {}),
  })

  if (!response.ok) {
    let errorBody: unknown
    try {
      errorBody = await response.clone().json()
    } catch {
      errorBody = await response.text()
    }
    throw new VisionClientError(
      `${method} ${resolvedPath} failed with HTTP ${response.status}`,
      response.status,
      errorBody
    )
  }

  const text = await response.text()
  if (!text) return undefined
  return JSON.parse(text) as unknown
}

// ============================================================================
// Main factory
// ============================================================================

/**
 * Create a type-safe Vision client backed by your `AppRouter` type.
 *
 * The returned object mirrors the `AppRouter` structure:
 * - one property per service name
 * - each service property has one property per route key (`"METHOD /path"`)
 * - GET routes expose `.queryOptions(input)` → use with TanStack `useQuery`
 * - other routes expose `.mutationOptions()` → use with TanStack `useMutation`
 * - every route also exposes `.call(input)` for direct imperative calls
 *
 * @example
 * ```ts
 * const client = createVisionClient<AppRouter>({ baseUrl: '/api' })
 *
 * // React Query usage
 * const { data } = useQuery(client.users['GET /users/:id'].queryOptions({ id: '123' }))
 * const mut = useMutation(client.users['POST /users'].mutationOptions())
 *
 * // Direct call
 * const user = await client.users['GET /users/:id'].call({ id: '123' })
 * ```
 */
export function createVisionClient<TRouter extends RouterDef>(
  config: VisionClientConfig = {}
): RouterClient<TRouter> {
  return new Proxy({} as RouterClient<TRouter>, {
    get(_target, serviceName: string | symbol) {
      if (typeof serviceName !== 'string') return undefined

      return new Proxy({} as ServiceClient<any>, {
        get(_serviceTarget, routeKey: string | symbol) {
          if (typeof routeKey !== 'string') return undefined

          const spaceIndex = routeKey.indexOf(' ')
          if (spaceIndex === -1) return undefined

          const method = routeKey.slice(0, spaceIndex)
          const isQuery = method === 'GET'

          if (isQuery) {
            const helper: QueryEndpointHelper<any> = {
              queryOptions: (input: Record<string, any> = {}) => ({
                queryKey: [serviceName, routeKey, input] as const,
                queryFn: () => callEndpoint(routeKey, input, config) as Promise<any>,
              }),
              call: (input: Record<string, any> = {}) =>
                callEndpoint(routeKey, input, config) as Promise<any>,
            }
            return helper
          } else {
            const helper: MutationEndpointHelper<any> = {
              mutationOptions: () => ({
                mutationFn: (input: Record<string, any> = {}) =>
                  callEndpoint(routeKey, input, config) as Promise<any>,
              }),
              call: (input: Record<string, any> = {}) =>
                callEndpoint(routeKey, input, config) as Promise<any>,
            }
            return helper
          }
        },
      })
    },
  })
}
