/**
 * Typed routes helper for compile-time type safety
 * Works with any framework (Hono, Express, Fastify)
 */

import type { VisionQueryProcedure, VisionMutationProcedure } from './inference'

/**
 * Define typed routes for Vision React Query
 *
 * @example
 * import { z } from 'zod'
 *
 * export const routes = defineTypedRoutes({
 *   chats: {
 *     paginated: {
 *       method: 'GET',
 *       path: '/chats/paginated',
 *       input: z.object({ pageId: z.string(), limit: z.number() }),
 *       output: z.array(chatSchema)
 *     }
 *   },
 *   pages: {
 *     create: {
 *       method: 'POST',
 *       path: '/pages/create',
 *       input: createPageSchema,
 *       output: pageSchema
 *     }
 *   }
 * })
 *
 * // Client usage with full type safety:
 * const api = createVisionClient<typeof routes>({ baseUrl: '...' })
 * const { data } = useQuery(api.chats.paginated.queryOptions({ pageId, limit: 50 }))
 * //    ^-- data is typed as z.infer<typeof chatSchema>[]
 */
export function defineTypedRoutes<TRoutes extends RouteDefinitions>(
  routes: TRoutes
): InferTypedRouter<TRoutes> {
  return routes as any
}

/**
 * Route definitions structure
 */
type RouteDefinitions = {
  [service: string]: {
    [procedure: string]: RouteDefinition
  }
}

type RouteDefinition = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  input?: any
  output?: any
}

/**
 * Infer router type from route definitions
 */
type InferTypedRouter<TRoutes extends RouteDefinitions> = {
  [TService in keyof TRoutes]: {
    [TProcedure in keyof TRoutes[TService]]: InferProcedureFromDefinition<
      TRoutes[TService][TProcedure]
    >
  }
}

/**
 * Infer procedure type from route definition
 */
type InferProcedureFromDefinition<TDef extends RouteDefinition> = TDef extends {
  method: 'GET'
  input: infer TInput
  output: infer TOutput
}
  ? VisionQueryProcedure<TInput, TOutput>
  : TDef extends {
      method: 'GET'
      output: infer TOutput
    }
    ? VisionQueryProcedure<void, TOutput>
    : TDef extends {
        method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
        input: infer TInput
        output: infer TOutput
      }
      ? VisionMutationProcedure<TInput, TOutput>
      : TDef extends {
          method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
          output: infer TOutput
        }
        ? VisionMutationProcedure<void, TOutput>
        : never

/**
 * Helper to infer input type from Zod schema
 */
export type InferInput<T> = T extends { _input: infer I }
  ? I
  : T extends { parse: (input: infer I) => any }
    ? I
    : never

/**
 * Helper to infer output type from Zod schema
 */
export type InferOutput<T> = T extends { _output: infer O }
  ? O
  : T extends { parse: (input: any) => infer O }
    ? O
    : never
