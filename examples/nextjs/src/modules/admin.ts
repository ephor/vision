import { createModule, rateLimit } from '@getvision/server'
import { z } from 'zod'

const Stats = z.object({
  users: z.number(),
  orders: z.number(),
  revenue: z.number(),
})

const Session = z.object({
  id: z.string(),
  userId: z.string(),
  createdAt: z.string(),
})

/**
 * `/admin/*` resource — grouped admin endpoints behind a `/admin` prefix.
 *
 * In a real app you'd add an auth `beforeHandle` at this module level so
 * every admin route inherits protection without repetition. Here we show a
 * module-wide rate-limit as an analog (4 requests / 30s).
 */
export const adminModule = createModule({ prefix: '/admin' })
  .onBeforeHandle(rateLimit({ requests: 10, window: '30s' }))
  .get(
    '/stats',
    ({ span }) =>
      span('db.select', { 'db.table': 'stats' }, () => ({
        users: 128,
        orders: 42,
        revenue: 12_990.5,
      })),
    { response: Stats }
  )
  .get(
    '/sessions',
    ({ span }) => {
      const sessions = span('db.select', { 'db.table': 'sessions' }, () => [
        { id: 's1', userId: '1', createdAt: new Date().toISOString() },
        { id: 's2', userId: '2', createdAt: new Date().toISOString() },
      ])
      return { sessions }
    },
    { response: z.object({ sessions: z.array(Session) }) }
  )
  .delete(
    '/sessions/:id',
    ({ params, span }) =>
      span('db.delete', { 'db.table': 'sessions', 'session.id': params.id }, () => ({
        revoked: params.id,
      })),
    {
      params: z.object({ id: z.string() }),
      response: z.object({ revoked: z.string() }),
    }
  )
