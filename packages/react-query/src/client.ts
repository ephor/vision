/**
 * Vision React Query Client
 * Type-safe API client with tRPC-like DX
 *
 * Auto-discovers routes from Vision Dashboard and generates client automatically
 */

import { QueryClient } from '@tanstack/react-query'
import type { UseQueryOptions, UseMutationOptions } from '@tanstack/react-query'
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
 * // With shared routes (best for monorepo)
 * import { routes } from './shared/routes'
 * const api = createVisionClient(routes, {
 *   baseUrl: 'http://localhost:3000'
 * })
 *
 * @example
 * // With type-only import (auto-discovery)
 * import type { AppRouter } from './server'
 * const api = createVisionClient<AppRouter>({
 *   baseUrl: 'http://localhost:3000',
 *   dashboardUrl: 'http://localhost:9500'
 * })
 */
export function createVisionClient<TAppOrContract = any>(
  routesOrConfig: TAppOrContract | VisionClientConfig,
  maybeConfig?: VisionClientConfig
): VisionClient<InferVisionRouter<TAppOrContract>> {
  // Determine if first arg is routes or config
  const isRoutesFirst = maybeConfig !== undefined
  const routes = isRoutesFirst ? routesOrConfig : undefined
  const config = isRoutesFirst ? maybeConfig! : (routesOrConfig as VisionClientConfig)
  const queryClient = config.queryClient || new QueryClient()
  const fetcher = config.fetch || (globalThis.fetch as typeof fetch)
  const dashboardUrl = config.dashboardUrl || 'http://localhost:9500'

  // Lazy-loaded routes metadata cache
  let routesMetadata: RouteMetadataExport[] | null = null
  let routesMap: Map<string, RouteMetadataExport> | null = null

  // Convert shared routes to metadata format
  const convertRoutesToMetadata = (routesObj: any): RouteMetadataExport[] => {
    const metadata: RouteMetadataExport[] = []

    for (const [serviceName, procedures] of Object.entries(routesObj)) {
      for (const [procedureName, route] of Object.entries(procedures as Record<string, any>)) {
        const routeData = route as any
        metadata.push({
          method: routeData.method,
          path: routeData.path,
          procedure: [serviceName, procedureName],
          type: routeData.method === 'GET' ? 'query' : 'mutation',
          schema: {
            input: routeData.input,
            output: routeData.output
          }
        })
      }
    }

    return metadata
  }

  // Fetch routes metadata from Vision Dashboard or use provided routes
  const fetchRoutesMetadata = async (): Promise<RouteMetadataExport[]> => {
    if (routesMetadata) return routesMetadata

    // If routes provided directly, use them
    if (routes) {
      routesMetadata = convertRoutesToMetadata(routes)

      // Build map for quick lookup
      routesMap = new Map()
      for (const route of routesMetadata) {
        routesMap.set(route.path, route)
      }

      console.log(`✅ Vision: Loaded ${routesMetadata.length} routes from shared schemas`)
      return routesMetadata
    }

    try {
      // Fetch routes metadata via simple HTTP GET
      const response = await fetcher(`${dashboardUrl}/api/routes-metadata`)

      if (!response.ok) {
        throw new Error(`Failed to fetch routes metadata: ${response.statusText}`)
      }

      const jsonRpcResponse = await response.json() as { result?: RouteMetadataExport[] }
      const fetchedRoutes: RouteMetadataExport[] = jsonRpcResponse.result || []
      routesMetadata = fetchedRoutes

      // Build map for quick lookup: /users/list → metadata
      routesMap = new Map()
      for (const route of fetchedRoutes) {
        routesMap.set(route.path, route)
      }

      console.log(`✅ Vision: Loaded ${fetchedRoutes.length} routes from dashboard`)
      return fetchedRoutes
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

  // Build URL from procedure path and substitute path params
  // Example: /users/:id/delete + { id: 123 } → /users/123/delete
  const buildUrl = (path: string, input?: any): string => {
    let url = path
    const pathParams: string[] = []

    // Extract and substitute path parameters
    if (input && typeof input === 'object') {
      url = path.replace(/:(\w+)/g, (match, paramName) => {
        pathParams.push(paramName)
        const value = input[paramName]
        return value !== undefined ? String(value) : match
      })
    }

    return `${config.baseUrl}${url}`
  }

  // Remove path params from input to get body params
  const getBodyParams = (path: string, input?: any): any => {
    if (!input || typeof input !== 'object') return input

    const pathParams = path.match(/:(\w+)/g)?.map(p => p.slice(1)) || []
    if (pathParams.length === 0) return input

    // Remove path params from input
    const bodyParams = { ...input }
    for (const param of pathParams) {
      delete bodyParams[param]
    }

    // Return undefined if no body params left
    return Object.keys(bodyParams).length > 0 ? bodyParams : undefined
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
      const path = routeMetadata?.path || `/${procedure.join('/')}`
      const url = buildUrl(path, input)
      const bodyParams = getBodyParams(path, input)
      const httpMethod = routeMetadata?.method || 'POST'
      const headers = await getHeaders()

      const response = await fetcher(url, {
        method: httpMethod,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: httpMethod !== 'GET' ? JSON.stringify(bodyParams) : undefined,
      })

      if (!response.ok) {
        throw new Error(`Vision API Error: ${response.statusText}`)
      }

      return response.json()
    }

    // Add methods to direct call function
    directCall.queryOptions = <TData = any>(
      input?: any,
      options?: Omit<UseQueryOptions<any, Error, TData>, 'queryKey' | 'queryFn'>
    ): UseQueryOptions<any, Error, TData> => ({
      queryKey: [...procedure, input],
      queryFn: async () => {
        const routeMetadata = await findRouteMetadata(procedure)
        const path = routeMetadata?.path || `/${procedure.join('/')}`
        const url = buildUrl(path, input)
        const bodyParams = getBodyParams(path, input)
        const httpMethod = routeMetadata?.method || 'GET'
        const headers = await getHeaders()

        const response = await fetcher(url, {
          method: httpMethod,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: httpMethod !== 'GET' ? JSON.stringify(bodyParams) : undefined,
        })

        if (!response.ok) {
          throw new Error(`Vision API Error: ${response.statusText}`)
        }

        return response.json()
      },
      ...options,
    })

    directCall.mutationOptions = <TContext = unknown>(
      options?: Omit<UseMutationOptions<any, Error, any, TContext>, 'mutationFn'>
    ): UseMutationOptions<any, Error, any, TContext> => ({
      mutationFn: async (mutationInput: any) => {
        const routeMetadata = await findRouteMetadata(procedure)
        const path = routeMetadata?.path || `/${procedure.join('/')}`
        const url = buildUrl(path, mutationInput)
        const bodyParams = getBodyParams(path, mutationInput)
        const httpMethod = routeMetadata?.method || 'POST'
        const headers = await getHeaders()

        const response = await fetcher(url, {
          method: httpMethod,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify(bodyParams),
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
          const path = routeMetadata?.path || `/${procedure.join('/')}`
          const url = buildUrl(path, input)
          const bodyParams = getBodyParams(path, input)
          const httpMethod = routeMetadata?.method || 'POST'
          const headers = await getHeaders()

          const response = await fetcher(url, {
            method: httpMethod,
            headers: {
              'Content-Type': 'application/json',
              ...headers,
            },
            body: httpMethod !== 'GET' ? JSON.stringify(bodyParams) : undefined,
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
