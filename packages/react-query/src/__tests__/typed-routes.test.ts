import { describe, test, expect } from 'bun:test'
import { defineTypedRoutes } from '../typed-routes'

describe('defineTypedRoutes', () => {
  test('should define typed routes', () => {
    const routes = defineTypedRoutes({
      users: {
        list: {
          method: 'GET',
          path: '/users/list',
          output: [] as { id: number; name: string }[]
        },
        create: {
          method: 'POST',
          path: '/users/create',
          input: {} as { name: string; email: string },
          output: {} as { id: number; name: string; email: string }
        }
      },
      posts: {
        get: {
          method: 'GET',
          path: '/posts/:id',
          input: {} as { id: string },
          output: {} as { id: string; title: string; content: string }
        }
      }
    })

    expect(routes).toBeDefined()
    expect(routes.users).toBeDefined()
    expect(routes.users.list).toBeDefined()
    expect(routes.users.list.method).toBe('GET')
    expect(routes.users.list.path).toBe('/users/list')
  })

  test('should preserve route structure', () => {
    const routes = defineTypedRoutes({
      chats: {
        paginated: {
          method: 'GET',
          path: '/chats/paginated',
          input: {} as { pageId: string; limit: number },
          output: [] as Array<{ id: string; message: string }>
        }
      }
    })

    expect(routes.chats.paginated.method).toBe('GET')
    expect(routes.chats.paginated.path).toBe('/chats/paginated')
  })

  test('should support mutations', () => {
    const routes = defineTypedRoutes({
      pages: {
        create: {
          method: 'POST',
          path: '/pages/create',
          input: {} as { title: string; content: string },
          output: {} as { id: string; title: string }
        },
        update: {
          method: 'PUT',
          path: '/pages/:id',
          input: {} as { id: string; title: string },
          output: {} as { id: string; title: string }
        },
        delete: {
          method: 'DELETE',
          path: '/pages/:id',
          input: {} as { id: string },
          output: {} as { success: boolean }
        }
      }
    })

    expect(routes.pages.create.method).toBe('POST')
    expect(routes.pages.update.method).toBe('PUT')
    expect(routes.pages.delete.method).toBe('DELETE')
  })
})
