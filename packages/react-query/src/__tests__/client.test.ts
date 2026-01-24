import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { createVisionClient } from '../client'
import { defineTypedRoutes } from '../typed-routes'
import { QueryClient } from '@tanstack/react-query'

// Mock fetch
const mockFetch = mock(async (url: string, options?: any) => {
  // Mock Vision Dashboard routes metadata endpoint
  if (url.includes('/api/routes-metadata')) {
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        result: [
          {
            method: 'GET',
            path: '/users/list',
            procedure: ['users', 'list'],
            type: 'query'
          },
          {
            method: 'POST',
            path: '/users/create',
            procedure: ['users', 'create'],
            type: 'mutation'
          }
        ],
        id: 1
      }),
      { status: 200 }
    )
  }

  // Mock actual API calls
  if (url.includes('/users/list')) {
    return new Response(
      JSON.stringify([
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' }
      ]),
      { status: 200 }
    )
  }

  if (url.includes('/users/create')) {
    const body = JSON.parse(options?.body || '{}')
    return new Response(
      JSON.stringify({ id: 3, ...body }),
      { status: 201 }
    )
  }

  return new Response('Not found', { status: 404 })
})

describe('createVisionClient', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  test('should create client with typed routes', () => {
    const routes = defineTypedRoutes({
      users: {
        list: {
          method: 'GET',
          path: '/users/list',
          output: [] as Array<{ id: number; name: string }>
        },
        create: {
          method: 'POST',
          path: '/users/create',
          input: {} as { name: string; email: string },
          output: {} as { id: number; name: string; email: string }
        }
      }
    })

    const api = createVisionClient<typeof routes>({
      baseUrl: 'http://localhost:3000',
      dashboardUrl: 'http://localhost:9500',
      fetch: mockFetch as any,
      queryClient: new QueryClient()
    })

    expect(api).toBeDefined()
    expect(api.queryClient).toBeDefined()
  })

  test('should generate queryOptions', async () => {
    const routes = defineTypedRoutes({
      users: {
        list: {
          method: 'GET',
          path: '/users/list',
          output: [] as Array<{ id: number; name: string }>
        }
      }
    })

    const api = createVisionClient<typeof routes>({
      baseUrl: 'http://localhost:3000',
      dashboardUrl: 'http://localhost:9500',
      fetch: mockFetch as any
    })

    const options = api.users.list.queryOptions({})

    expect(options).toBeDefined()
    expect(options.queryKey).toEqual(['users', 'list', {}])
    expect(options.queryFn).toBeDefined()

    // Test queryFn
    const data = await options.queryFn()
    expect(data).toEqual([
      { id: 1, name: 'John' },
      { id: 2, name: 'Jane' }
    ])
  })

  test('should generate mutationOptions', async () => {
    const routes = defineTypedRoutes({
      users: {
        create: {
          method: 'POST',
          path: '/users/create',
          input: {} as { name: string; email: string },
          output: {} as { id: number; name: string; email: string }
        }
      }
    })

    const api = createVisionClient<typeof routes>({
      baseUrl: 'http://localhost:3000',
      dashboardUrl: 'http://localhost:9500',
      fetch: mockFetch as any
    })

    const options = api.users.create.mutationOptions()

    expect(options).toBeDefined()
    expect(options.mutationFn).toBeDefined()

    // Test mutationFn
    const data = await options.mutationFn({ name: 'Bob', email: 'bob@example.com' })
    expect(data).toEqual({ id: 3, name: 'Bob', email: 'bob@example.com' })
  })

  test('should support custom headers', async () => {
    const routes = defineTypedRoutes({
      users: {
        list: {
          method: 'GET',
          path: '/users/list',
          output: [] as Array<{ id: number; name: string }>
        }
      }
    })

    const api = createVisionClient<typeof routes>({
      baseUrl: 'http://localhost:3000',
      dashboardUrl: 'http://localhost:9500',
      fetch: mockFetch as any,
      headers: {
        authorization: 'Bearer test-token'
      }
    })

    const options = api.users.list.queryOptions({})
    await options.queryFn()

    // Check that fetch was called with auth header
    expect(mockFetch).toHaveBeenCalled()
    const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
    expect(lastCall[1]?.headers?.authorization).toBe('Bearer test-token')
  })

  test('should support async headers', async () => {
    const routes = defineTypedRoutes({
      users: {
        list: {
          method: 'GET',
          path: '/users/list',
          output: [] as Array<{ id: number; name: string }>
        }
      }
    })

    const api = createVisionClient<typeof routes>({
      baseUrl: 'http://localhost:3000',
      dashboardUrl: 'http://localhost:9500',
      fetch: mockFetch as any,
      headers: async () => ({
        authorization: 'Bearer dynamic-token'
      })
    })

    const options = api.users.list.queryOptions({})
    await options.queryFn()

    const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
    expect(lastCall[1]?.headers?.authorization).toBe('Bearer dynamic-token')
  })

  test('should handle errors gracefully', async () => {
    const errorFetch = mock(async () => {
      return new Response('Internal Server Error', { status: 500 })
    })

    const routes = defineTypedRoutes({
      users: {
        list: {
          method: 'GET',
          path: '/users/list',
          output: [] as Array<{ id: number; name: string }>
        }
      }
    })

    const api = createVisionClient<typeof routes>({
      baseUrl: 'http://localhost:3000',
      dashboardUrl: 'http://localhost:9500',
      fetch: errorFetch as any
    })

    const options = api.users.list.queryOptions({})

    await expect(options.queryFn()).rejects.toThrow('Vision API Error')
  })

  test('should fallback when dashboard is unavailable', async () => {
    const failingFetch = mock(async (url: string, options?: any) => {
      // Dashboard unavailable
      if (url.includes('/api/routes-metadata')) {
        return new Response('Not found', { status: 404 })
      }
      // But API still works
      if (url.includes('/users/list')) {
        return new Response(JSON.stringify([{ id: 1, name: 'John' }]), { status: 200 })
      }
      return new Response('Not found', { status: 404 })
    })

    const routes = defineTypedRoutes({
      users: {
        list: {
          method: 'GET',
          path: '/users/list',
          output: [] as Array<{ id: number; name: string }>
        }
      }
    })

    const api = createVisionClient<typeof routes>({
      baseUrl: 'http://localhost:3000',
      dashboardUrl: 'http://localhost:9500',
      fetch: failingFetch as any
    })

    // Should still work with manual routing
    const options = api.users.list.queryOptions({})
    const data = await options.queryFn()

    expect(data).toEqual([{ id: 1, name: 'John' }])
  })
})
