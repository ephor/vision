import { createModule, defineEvents, defineCrons, rateLimit } from '@getvision/server'
import { z } from 'zod'

const User = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
})

const UserWithArticles = User.extend({
  articles: z.array(z.object({ id: z.string(), title: z.string() })),
})

const UserCreated = z.object({
  userId: z.string(),
  email: z.string().email(),
  name: z.string(),
})

export const usersModule = createModule({ prefix: '/users' })
  .use(
    defineEvents({
      'user/created': {
        schema: UserCreated,
        description: 'User account created',
        icon: '👤',
        tags: ['user', 'auth'],
        handler: async (event) => {
          console.log('📧 Sending welcome email to:', event.email)
        },
      },
    })
  )
  .use(
    defineCrons({
      'users.daily-cleanup': {
        schedule: '0 0 * * *',
        description: 'Daily user cleanup',
        icon: '🧹',
        tags: ['maintenance'],
        handler: async () => {
          console.log('🧹 Running daily user cleanup')
        },
      },
    })
  )
  .get(
    '/',
    ({ span }) => {
      const users = span(
        'db.select',
        { 'db.system': 'postgresql', 'db.table': 'users' },
        () => {
          sleep(30)
          return [
            { id: '1', name: 'Alice', email: 'alice@example.com' },
            { id: '2', name: 'Bob', email: 'bob@example.com' },
          ]
        }
      )
      return { users }
    },
    {
      response: z.object({ users: z.array(User) }),
    }
  )
  .get(
    '/:id',
    ({ params, query, span, addContext }) => {
      addContext({
        'user.id': params.id,
        'request.type': 'user_details',
        'user.isActive': query.isActive,
      })

      const user = span(
        'db.select',
        { 'db.system': 'postgresql', 'db.table': 'users' },
        () => {
          sleep(50)
          return { id: params.id, name: 'Alice', email: 'alice@example.com' }
        }
      )

      const articles = span(
        'db.select',
        { 'db.system': 'postgresql', 'db.table': 'articles' },
        () => {
          sleep(80)
          return [
            { id: '1', title: 'First Article' },
            { id: '2', title: 'Second Article' },
          ]
        }
      )

      return { ...user, articles }
    },
    {
      params: z.object({ id: z.string() }),
      query: z.object({ isActive: z.string().optional() }),
      response: UserWithArticles,
    }
  )
  .post(
    '/',
    async ({ body, emit, span }) => {
      const userId = Math.random().toString(36).substring(7)

      const user = span(
        'db.insert',
        { 'db.system': 'postgresql', 'db.table': 'users' },
        () => ({ id: userId, ...body })
      )

      await emit('user/created', {
        userId,
        email: body.email,
        name: body.name,
      })

      return user
    },
    {
      body: z.object({
        name: z.string().min(1).describe('Full name'),
        email: z.string().email().describe('Email address'),
      }),
      response: User,
      // 5 signups per IP per 15 minutes
      beforeHandle: [rateLimit({ requests: 5, window: '15m' })],
    }
  )

function sleep(ms: number) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    /* busy wait for demo */
  }
}
