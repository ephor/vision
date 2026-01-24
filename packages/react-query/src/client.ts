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

  // Create procedure client (callable + methods)
  const createProcedureClient = (procedure: string[]) => {
    // Direct call function
    const directCall = async (input?: any) => {
      const routeMetadata = await findRouteMetadata(procedure)
      const url = buildUrl(procedure)
      const httpMethod = routeMetadata?.method || 'POST'
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

    // Add methods to direct call function
    directCall.queryOptions = (input?: any, options?: any) => ({
      queryKey: [...procedure, input],
      queryFn: async () => {
        const routeMetadata = await findRouteMetadata(procedure)
        const url = buildUrl(procedure)
        const httpMethod = routeMetadata?.method || 'POST'
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
    })

    directCall.mutationOptions = (options?: any) => ({
      mutationFn: async (mutationInput: any) => {
        const routeMetadata = await findRouteMetadata(procedure)
        const url = buildUrl(procedure)
        const httpMethod = routeMetadata?.method || 'POST'
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
    })

    directCall.prefetch = async (input?: any) => {
      const queryKey = [...procedure, input]
      return queryClient.prefetchQuery({
        queryKey,
        queryFn: async () => {
          const routeMetadata = await findRouteMetadata(procedure)
          const url = buildUrl(procedure)
          const httpMethod = routeMetadata?.method || 'POST'
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

    return directCall
  }

  // Create recursive proxy
  const createProxy = (path: string[] = []): any => {
    // Create base proxy
    const proxy = new Proxy(() => {}, {
      get(_target, key) {
        if (typeof key !== 'string') return undefined
        if (key === 'then') return undefined // Prevent Promise detection
        if (key === 'queryClient') return queryClient

        // Special methods - return bound functions
        if (key === 'queryOptions') {
          return (input?: any, options?: any) =>
            createProcedureClient(path).queryOptions(input, options)
        }
        if (key === 'mutationOptions') {
          return (options?: any) => createProcedureClient(path).mutationOptions(options)
        }
        if (key === 'prefetch') {
          return (input?: any) => createProcedureClient(path).prefetch(input)
        }

        // Continue nesting
        return createProxy([...path, key])
      },

      apply(_target, _thisArg, args) {
        // Direct call
        return createProcedureClient(path)(args[0])
      },
    })

    return proxy
  }

  const client = createProxy() as any

  // Attach queryClient to root
  Object.defineProperty(client, 'queryClient', {
    value: queryClient,
    enumerable: false,
    writable: false,
    configurable: false,
  })

  // Add init method for eager loading
  Object.defineProperty(client, 'init', {
    value: async () => {
      await fetchRoutesMetadata()
    },
    enumerable: false,
    writable: false,
    configurable: false,
  })

  return client
}
