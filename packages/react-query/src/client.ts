/**
 * Vision React Query Client
 * Type-safe API client with tRPC-like DX
 *
 * Auto-discovers routes from Vision Dashboard and generates client automatically
 */

import { QueryClient } from '@tanstack/react-query'
import type { VisionClient, InferVisionRouter } from './inference'

/**
 * Client configuration
 */
export type VisionClientConfig = {
  /**
   * Base URL for API requests (your app, not Vision Dashboard)
   */
  baseUrl: string

  /**
   * Vision Dashboard URL (for fetching routes metadata)
   * Default: http://localhost:9500
   */
  dashboardUrl?: string

  /**
   * Query client instance (optional, creates new if not provided)
   */
  queryClient?: QueryClient

  /**
   * Headers to include in all requests
   */
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>)

  /**
   * Custom fetch implementation (for SSR, testing, etc.)
   */
  fetch?: typeof fetch

  /**
   * Batch requests (future feature)
   */
  batch?: {
    enabled: boolean
    maxBatchSize?: number
  }
}

/**
 * Route metadata from Vision Dashboard
 */
type RouteMetadataExport = {
  method: string
  path: string
  procedure: string[] // ['users', 'list']
  type: 'query' | 'mutation'
  schema?: {
    input?: any
    output?: any
  }
}

/**
 * Create Vision React Query client
 *
 * Auto-discovers routes from your API and generates type-safe client
 *
 * @example
 * // With Hono/Express/Fastify adapter
 * import type { AppRouter } from './server' // Type only!
 *
 * const api = createVisionClient<AppRouter>({
 *   baseUrl: 'http://localhost:3000',        // Your API
 *   dashboardUrl: 'http://localhost:9500'    // Vision Dashboard (optional)
 * })
 *
 * // Usage - like tRPC!
 * const { data } = useQuery(api.chats.paginated.queryOptions({ pageId, limit: 50 }))
 */
export function createVisionClient<TAppOrContract>(
  config: VisionClientConfig
): VisionClient<InferVisionRouter<TAppOrContract>> {
  const queryClient = config.queryClient || new QueryClient()
  const fetcher = config.fetch || (globalThis.fetch as typeof fetch)
  const dashboardUrl = config.dashboardUrl || 'http://localhost:9500'

  // Lazy-loaded routes metadata cache
  let routesMetadata: RouteMetadataExport[] | null = null
  let routesMap: Map<string, RouteMetadataExport> | null = null

  // Fetch routes metadata from Vision Dashboard
  const fetchRoutesMetadata = async (): Promise<RouteMetadataExport[]> => {
    if (routesMetadata) return routesMetadata

    try {
      // Fetch routes metadata via simple HTTP GET
      const response = await fetcher(`${dashboardUrl}/api/routes-metadata`)

      if (!response.ok) {
        throw new Error(`Failed to fetch routes metadata: ${response.statusText}`)
      }

      const jsonRpcResponse = await response.json()
      routesMetadata = jsonRpcResponse.result || []

      // Build map for quick lookup: /users/list → metadata
      routesMap = new Map()
      for (const route of routesMetadata) {
        routesMap.set(route.path, route)
      }

      console.log(`✅ Vision: Loaded ${routesMetadata.length} routes from dashboard`)
      return routesMetadata
    } catch (error) {
      console.warn('⚠️  Failed to fetch Vision routes metadata:', error)
      console.warn('   Using manual route mapping as fallback')
      console.warn('   Make sure Vision Dashboard is running at:', dashboardUrl)
      routesMetadata = []
      routesMap = new Map()
      return []
    }
  }

  // Resolve headers (can be async function)
  const getHeaders = async (): Promise<HeadersInit> => {
    if (!config.headers) return {}
    if (typeof config.headers === 'function') {
      return await config.headers()
    }
    return config.headers
  }

  // Build URL from procedure path: ['users', 'list'] → '/users/list'
  const buildUrl = (procedure: string[]): string => {
    return `${config.baseUrl}/${procedure.join('/')}`
  }

  // Find route metadata by procedure path
  const findRouteMetadata = async (procedure: string[]): Promise<RouteMetadataExport | null> => {
    await fetchRoutesMetadata()

    const path = `/${procedure.join('/')}`
    return routesMap?.get(path) || null
  }

  // Create recursive proxy for service.procedure.method() pattern
  const client = createRecursiveProxy(async ({ path, args }) => {
    const procedure = path
    const method = args.length > 0 && typeof args[0] === 'string' ? args[0] : null

    // Get route metadata
    const routeMetadata = await findRouteMetadata(procedure)
    const url = buildUrl(procedure)
    const httpMethod = routeMetadata?.method || 'POST'

    // Input is first argument (or second if first is method name)
    const input = method ? args[1] : args[0]

    // Method-specific logic
    if (!method || method === 'call') {
      // Direct call: api.users.list({ limit: 10 })
      const headers = await getHeaders()
      const response = await fetcher(url, {
        method: httpMethod,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: httpMethod !== 'GET' ? JSON.stringify(input) : undefined,
      })

      if (!response.ok) {
        throw new Error(`Vision API Error: ${response.statusText}`)
      }

      return response.json()
    }

    // queryOptions: api.users.list.queryOptions({ limit: 10 })
    if (method === 'queryOptions') {
      const options = args[1] || {}
      return {
        queryKey: [...procedure, input],
        queryFn: async () => {
          const headers = await getHeaders()
          const response = await fetcher(url, {
            method: httpMethod,
            headers: {
              'Content-Type': 'application/json',
              ...headers,
            },
            body: httpMethod !== 'GET' ? JSON.stringify(input) : undefined,
          })

          if (!response.ok) {
            throw new Error(`Vision API Error: ${response.statusText}`)
          }

          return response.json()
        },
        ...options,
      }
    }

    // mutationOptions: api.users.create.mutationOptions()
    if (method === 'mutationOptions') {
      const options = args[0] || {}
      return {
        mutationFn: async (mutationInput: any) => {
          const headers = await getHeaders()
          const response = await fetcher(url, {
            method: httpMethod,
            headers: {
              'Content-Type': 'application/json',
              ...headers,
            },
            body: JSON.stringify(mutationInput),
          })

          if (!response.ok) {
            throw new Error(`Vision API Error: ${response.statusText}`)
          }

          return response.json()
        },
        ...options,
      }
    }

    // prefetch: await api.users.list.prefetch({ limit: 10 })
    if (method === 'prefetch') {
      const queryKey = [...procedure, input]
      return queryClient.prefetchQuery({
        queryKey,
        queryFn: async () => {
          const headers = await getHeaders()
          const response = await fetcher(url, {
            method: httpMethod,
            headers: {
              'Content-Type': 'application/json',
              ...headers,
            },
            body: httpMethod !== 'GET' ? JSON.stringify(input) : undefined,
          })

          if (!response.ok) {
            throw new Error(`Vision API Error: ${response.statusText}`)
          }

          return response.json()
        },
      })
    }

    throw new Error(`Unknown method: ${method}`)
  }) as any

  // Attach queryClient to root
  Object.defineProperty(client, 'queryClient', {
    value: queryClient,
    enumerable: false,
    writable: false,
  })

  // Add init method for eager loading
  Object.defineProperty(client, 'init', {
    value: async () => {
      await fetchRoutesMetadata()
    },
    enumerable: false,
    writable: false,
  })

  return client
}

/**
 * Create recursive proxy for service.procedure.method() pattern
 * Inspired by tRPC implementation
 */
function createRecursiveProxy(
  callback: (opts: { path: string[]; args: unknown[] }) => unknown
): any {
  const proxy = new Proxy(() => {}, {
    get(_target, key) {
      if (typeof key !== 'string') return undefined
      if (key === 'then') return undefined // Prevent Promise detection

      // Return nested proxy
      return createRecursiveProxy(({ path, args }) => {
        return callback({ path: [key, ...path], args })
      })
    },

    apply(_target, _thisArg, args) {
      return callback({ path: [], args })
    },
  })

  return proxy
}
