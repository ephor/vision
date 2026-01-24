/**
 * Vision React Query Server utilities
 * SSR support for Next.js App Router, Remix, etc.
 */

import { QueryClient, dehydrate } from '@tanstack/react-query'
import { createVisionClient } from './client'
import type { VisionClientConfig } from './client'
import type { InferVisionRouter, VisionClient } from './inference'

/**
 * Create Vision client for server-side rendering
 *
 * @example
 * // Next.js App Router
 * import { headers, cookies } from 'next/headers'
 *
 * const api = createVisionServerClient<typeof contract>({
 *   baseUrl: 'http://localhost:3000',
 *   headers: {
 *     cookie: cookies().toString(),
 *     authorization: headers().get('authorization') || ''
 *   }
 * })
 *
 * // Prefetch data
 * await api.users.list.prefetch({ limit: 10 })
 *
 * // Dehydrate for client
 * const dehydratedState = dehydrate(api.queryClient)
 */
export function createVisionServerClient<TAppOrContract>(
  config: Omit<VisionClientConfig, 'queryClient'> & {
    /**
     * Override query client defaults for SSR
     */
    queryClientConfig?: {
      defaultOptions?: {
        queries?: {
          staleTime?: number
          gcTime?: number
        }
      }
    }
  }
): VisionClient<InferVisionRouter<TAppOrContract>> {
  // Create new query client for each request (important for SSR!)
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute default
        ...config.queryClientConfig?.defaultOptions?.queries,
      },
    },
  })

  return createVisionClient<TAppOrContract>({
    ...config,
    queryClient,
  })
}

/**
 * Helper to get dehydrated state from client
 *
 * @example
 * const api = createVisionServerClient<typeof contract>({ ... })
 * await api.users.list.prefetch({ limit: 10 })
 *
 * return (
 *   <HydrationBoundary state={getDehydratedState(api)}>
 *     <UserList />
 *   </HydrationBoundary>
 * )
 */
export function getDehydratedState<TClient extends VisionClient<any>>(
  client: TClient
): ReturnType<typeof dehydrate> {
  return dehydrate(client.queryClient)
}

/**
 * Create headers from Next.js request
 *
 * @example
 * import { headers, cookies } from 'next/headers'
 *
 * const api = createVisionServerClient<typeof contract>({
 *   baseUrl: 'http://localhost:3000',
 *   headers: createNextHeaders()
 * })
 */
export function createNextHeaders(): HeadersInit {
  // Dynamically import to avoid bundling Next.js in client
  try {
    // Next.js 13+ App Router
    const { headers: getHeaders, cookies: getCookies } = require('next/headers')
    const headersList = getHeaders()
    const cookieStore = getCookies()

    return {
      cookie: cookieStore.toString(),
      authorization: headersList.get('authorization') || '',
      'user-agent': headersList.get('user-agent') || '',
    }
  } catch (error) {
    console.warn('createNextHeaders: Next.js headers/cookies not available')
    return {}
  }
}

/**
 * Create headers from Remix request
 *
 * @example
 * export async function loader({ request }: LoaderFunctionArgs) {
 *   const api = createVisionServerClient<typeof contract>({
 *     baseUrl: 'http://localhost:3000',
 *     headers: createRemixHeaders(request)
 *   })
 * }
 */
export function createRemixHeaders(request: Request): HeadersInit {
  return {
    cookie: request.headers.get('cookie') || '',
    authorization: request.headers.get('authorization') || '',
    'user-agent': request.headers.get('user-agent') || '',
  }
}
