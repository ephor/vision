/**
 * Vision Contract Definition
 * Define type-safe API contracts for adapters (Express/Fastify/Hono)
 */

import type { VisionContract, VisionProcedure } from './inference'

/**
 * Define Vision contract for type-safe client generation
 *
 * @example
 * import { z } from 'zod'
 *
 * export const contract = defineVisionContract({
 *   users: {
 *     list: {
 *       type: 'query',
 *       input: z.object({ limit: z.number() }),
 *       output: z.array(userSchema)
 *     },
 *     create: {
 *       type: 'mutation',
 *       input: createUserSchema,
 *       output: userSchema
 *     }
 *   }
 * })
 *
 * // Client usage
 * const api = createVisionClient<typeof contract>({ ... })
 * const users = await api.users.list({ limit: 10 })
 */
export function defineVisionContract<TContract extends VisionContract>(
  contract: TContract
): TContract {
  return contract
}

/**
 * Helper to define a query procedure
 */
export function query<TInput = void, TOutput = unknown>(config: {
  input?: TInput
  output: TOutput
  path?: string
  method?: 'GET' | 'POST'
}): VisionProcedure {
  return {
    type: 'query',
    ...config,
  }
}

/**
 * Helper to define a mutation procedure
 */
export function mutation<TInput = void, TOutput = unknown>(config: {
  input?: TInput
  output: TOutput
  path?: string
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
}): VisionProcedure {
  return {
    type: 'mutation',
    ...config,
  }
}

/**
 * Example usage:
 *
 * const contract = defineVisionContract({
 *   users: {
 *     list: query({
 *       input: z.object({ limit: z.number() }),
 *       output: z.array(userSchema),
 *       path: '/api/users',
 *       method: 'GET'
 *     }),
 *     create: mutation({
 *       input: createUserSchema,
 *       output: userSchema,
 *       path: '/api/users',
 *       method: 'POST'
 *     })
 *   }
 * })
 */
