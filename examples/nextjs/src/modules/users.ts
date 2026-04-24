import { createModule, defineEvents, rateLimit } from '@getvision/server'
import { z } from 'zod'

const User = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
})

const UserCreated = z.object({
  userId: z.string(),
  email: z.string().email(),
  name: z.string(),
})

/**
 * `/users` resource — flat collection + dynamic detail route + rate-limited
 * signup. Shows the most common pattern.
 */
export const usersModule = createModule({ prefix: '/users' })
  .use(
    defineEvents({
      'user/created': {
        schema: UserCreated,
        description: 'User account created',
        icon: '👤',
        tags: ['user', 'auth'],
        handler: async (event) => {
          console.log('[users] 📧 Welcome email →', event.email)
        },
      },
    })
  )
  .get(
    '/',
    ({ span }) => {
      const users = span('db.select', { 'db.table': 'users' }, () => [
        { id: '1', name: 'Alice', email: 'alice@example.com' },
        { id: '2', name: 'Bob', email: 'bob@example.com' },
      ])
      return { users }
    },
    { response: z.object({ users: z.array(User) }) }
  )
  .get(
    '/:id',
    ({ params, span, addContext }) => {
      addContext({ 'user.id': params.id })
      return span('db.select', { 'db.table': 'users', 'user.id': params.id }, () => ({
        id: params.id,
        name: 'Alice',
        email: 'alice@example.com',
      }))
    },
    {
      params: z.object({ id: z.string() }),
      response: User,
    }
  )
  .post(
    '/',
    async ({ body, emit, span }) => {
      const userId = Math.random().toString(36).substring(2, 8)
      const user = span('db.insert', { 'db.table': 'users' }, () => ({
        id: userId,
        ...body,
      }))
      await emit('user/created', { userId, email: body.email, name: body.name })
      return user
    },
    {
      body: z.object({
        name: z.string().min(1),
        email: z.string().email(),
      }),
      response: User,
      beforeHandle: [rateLimit({ requests: 3, window: '1m' })],
    }
  )
