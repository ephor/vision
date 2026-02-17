/**
 * @getvision/client
 *
 * Type-safe TanStack Query client for Vision services.
 * Generates fully-typed `queryOptions` / `mutationOptions` from your
 * `AppRouter` type — no tRPC, no code generation, no runtime schema transfer.
 *
 * ## How it works
 *
 * 1. Your server file exports `AppRouter` built from `InferServiceEndpoints`:
 * ```ts
 * // server/app.ts
 * import { Vision } from '@getvision/server'
 * import type { InferServiceEndpoints } from '@getvision/server'
 *
 * const userService = app.service('users')
 *   .endpoint('GET', '/users/:id', {
 *     input:  z.object({ isActive: z.string() }),   // ← query param only; `:id` is separate
 *     output: z.object({ id: z.string(), name: z.string() }),
 *   }, handler)
 *   .endpoint('POST', '/users', {
 *     input:  z.object({ name: z.string(), email: z.string() }),
 *     output: z.object({ id: z.string(), name: z.string(), email: z.string() }),
 *   }, handler)
 *
 * export type AppRouter = {
 *   users: InferServiceEndpoints<typeof userService>
 * }
 * ```
 *
 * 2. Your client file imports the type and creates the client:
 * ```ts
 * // client/api.ts
 * import { createVisionClient } from '@getvision/client'
 * import type { AppRouter } from '../server/app'
 *
 * export const client = createVisionClient<AppRouter>({
 *   baseUrl: 'http://localhost:4000',
 *   // Dynamic auth — called fresh on every request:
 *   headers: () => ({ Authorization: `Bearer ${getToken()}` }),
 * })
 * ```
 *
 * 3. Use in React components:
 * ```ts
 * // GET — queryOptions, id is required (path param), isActive is query param
 * const { data } = useQuery(
 *   client.users['GET /users/:id'].queryOptions({ id: '123', isActive: 'true' })
 * )
 * // data: { id: string; name: string } | undefined  ← fully typed
 *
 * // POST — mutationOptions
 * const mut = useMutation(client.users['POST /users'].mutationOptions())
 * mut.mutate({ name: 'Alice', email: 'alice@example.com' })
 * ```
 */

// ============================================================================
// Type utilities — path param extraction
// ============================================================================

/**
 * Recursively extract `:param` names from a URL path string as a union.
 * @example ExtractPathParams<'/users/:id/posts/:postId'> → 'id' | 'postId'
 * @example ExtractPathParams<'/users'>                   → never
 */
type ExtractPathParams<P extends string> =
  P extends `${string}:${infer Param}/${infer Rest}`
    ? Param | ExtractPathParams<Rest>
    : P extends `${string}:${infer Param}`
      ? Param
      : never

/**
 * Build `{ id: string; postId: string }` from a path like `/users/:id/posts/:postId`.
 * Produces `{}` when there are no path params (mapped type over `never` = `{}`).
 */
type PathParamRecord<P extends string> = { [K in ExtractPathParams<P>]: string }

/** Extract `/path` from a route key like `"GET /path"`. */
type RouteKeyPath<K extends string> = K extends `${string} ${infer Path}` ? Path : ''

/**
 * The full input type the client expects for an endpoint:
 * schema input (query params / body) merged with required path params.
 *
 * @example
 * // Route:  GET /users/:id
 * // Schema: { isActive: string }      ← query param
 * // Result: { isActive: string } & { id: string }  ← client must supply both
 */
type ClientInput<K extends string, TDef extends EndpointDef> =
  TDef['input'] & PathParamRecord<RouteKeyPath<K>>

// ============================================================================
// HTTP method helpers
// ============================================================================

type QueryMethod = 'GET'
type MutationMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE'
type HttpMethod = QueryMethod | MutationMethod

type ExtractMethod<K extends string> = K extends `${infer M} ${string}` ? M : never
type IsQuery<K extends string> = ExtractMethod<K> extends QueryMethod ? true : false

// ============================================================================
// Public endpoint/router types
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

/**
 * Helper exposed for GET endpoints.
 * `ClientInput` merges schema input with required path params from the route key.
 */
type QueryEndpointHelper<K extends string, TDef extends EndpointDef> = {
  /**
   * Returns `{ queryKey, queryFn }` compatible with TanStack Query `useQuery`.
   * Path params (`:id`, `:postId`, …) are required alongside schema input fields.
   */
  queryOptions: (input: ClientInput<K, TDef>) => VisionQueryOptions<TDef['output']>
  /** Directly call the endpoint, bypassing the query cache. */
  call: (input: ClientInput<K, TDef>) => Promise<TDef['output']>
}

/**
 * Helper exposed for POST / PUT / PATCH / DELETE endpoints.
 * Path params are folded into the `mutationFn` argument type.
 */
type MutationEndpointHelper<K extends string, TDef extends EndpointDef> = {
  /**
   * Returns `{ mutationFn }` compatible with TanStack Query `useMutation`.
   * Path params + body fields are all part of the single `input` argument.
   */
  mutationOptions: () => VisionMutationOptions<ClientInput<K, TDef>, TDef['output']>
  /** Directly call the endpoint, bypassing mutation state. */
  call: (input: ClientInput<K, TDef>) => Promise<TDef['output']>
}

type EndpointHelper<K extends string, TDef extends EndpointDef> =
  IsQuery<K> extends true
    ? QueryEndpointHelper<K, TDef>
    : MutationEndpointHelper<K, TDef>

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
  /**
   * Headers attached to every request.
   *
   * Pass a **plain object** for static headers:
   * ```ts
   * headers: { 'X-Api-Key': 'secret' }
   * ```
   *
   * Pass a **function** (sync or async) for dynamic headers — the function is
   * called fresh on every request, so tokens are never stale:
   * ```ts
   * headers: () => ({ Authorization: `Bearer ${store.getToken()}` })
   * headers: async () => ({ Authorization: `Bearer ${await refreshToken()}` })
   * ```
   */
  headers?:
    | Record<string, string>
    | (() => Record<string, string> | Promise<Record<string, string>>)
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

async function resolveHeaders(
  headers: VisionClientConfig['headers']
): Promise<Record<string, string>> {
  if (!headers) return {}
  return typeof headers === 'function' ? await headers() : headers
}

async function callEndpoint(
  routeKey: string,
  input: Record<string, any>,
  config: VisionClientConfig
): Promise<unknown> {
  const spaceIndex = routeKey.indexOf(' ')
  if (spaceIndex === -1)
    throw new Error(`Invalid route key: "${routeKey}". Expected "METHOD /path".`)

  const method = routeKey.slice(0, spaceIndex) as HttpMethod
  const path = routeKey.slice(spaceIndex + 1)
  const baseUrl = (config.baseUrl ?? '').replace(/\/$/, '')

  // Substitute :param placeholders; track which keys were consumed.
  const usedParams = new Set<string>()
  const resolvedPath = path.replace(/:([^/]+)/g, (_match, param: string) => {
    usedParams.add(param)
    const value = input[param]
    if (value === undefined)
      throw new Error(`Missing required path parameter ":${param}" for ${routeKey}`)
    return encodeURIComponent(String(value))
  })

  let url = baseUrl + resolvedPath
  let body: string | undefined

  if (method === 'GET' || method === 'DELETE') {
    // Non-path-param input fields → query string
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(input ?? {})) {
      if (!usedParams.has(key) && value !== undefined && value !== null) {
        params.append(key, String(value))
      }
    }
    const search = params.toString()
    if (search) url += `?${search}`
  } else {
    // Non-path-param input fields → JSON body (preserve original types)
    const bodyObj: Record<string, any> = {}
    for (const [key, value] of Object.entries(input ?? {})) {
      if (!usedParams.has(key) && value !== undefined && value !== null) {
        bodyObj[key] = value
      }
    }
    if (Object.keys(bodyObj).length > 0) body = JSON.stringify(bodyObj)
  }

  const resolvedHeaders = await resolveHeaders(config.headers)
  const fetchFn = config.fetch ?? globalThis.fetch

  const response = await fetchFn(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...resolvedHeaders,
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
 * - **GET** routes expose `.queryOptions(input)` → use with `useQuery`
 * - **POST/PUT/PATCH/DELETE** routes expose `.mutationOptions()` → use with `useMutation`
 * - all routes expose `.call(input)` for direct imperative fetches
 *
 * Path params (`:id`, `:slug`, …) are **automatically required** in the input
 * type even if they are not part of the Zod schema — the client extracts them
 * from the route key at the type level and substitutes them at runtime.
 *
 * @example
 * ```ts
 * const client = createVisionClient<AppRouter>({
 *   baseUrl: 'http://localhost:4000',
 *   headers: () => ({ Authorization: `Bearer ${getToken()}` }),
 * })
 *
 * // GET with path param + query param
 * const { data } = useQuery(
 *   client.users['GET /users/:id'].queryOptions({ id: '123', isActive: 'true' })
 * )
 * // data: { id: string; name: string; ... } | undefined
 *
 * // POST — body fields only
 * const mut = useMutation(client.users['POST /users'].mutationOptions())
 * mut.mutate({ name: 'Alice', email: 'alice@example.com' })
 *
 * // Direct call
 * const user = await client.users['GET /users/:id'].call({ id: '123', isActive: 'true' })
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
            const helper: QueryEndpointHelper<string, any> = {
              queryOptions: (input: Record<string, any> = {}) => ({
                queryKey: [serviceName, routeKey, input] as const,
                queryFn: () => callEndpoint(routeKey, input, config) as Promise<any>,
              }),
              call: (input: Record<string, any> = {}) =>
                callEndpoint(routeKey, input, config) as Promise<any>,
            }
            return helper
          } else {
            const helper: MutationEndpointHelper<string, any> = {
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
