/**
 * Type inference for Hono apps
 * Extracts route types from Hono Schema
 */

import type { VisionQueryProcedure, VisionMutationProcedure } from './inference'

/**
 * Extract schema from Hono app
 */
type ExtractHonoSchema<T> = T extends { $get: any }
  ? T['$get']
  : T extends { $post: any }
    ? T['$post']
    : T extends { $put: any }
      ? T['$put']
      : T extends { $patch: any }
        ? T['$patch']
        : T extends { $delete: any }
          ? T['$delete']
          : never

/**
 * Check if route is a query (GET) or mutation
 */
type IsQuery<T> = T extends { $get: any } ? true : false

/**
 * Infer procedure from Hono route schema
 */
type InferHonoProcedure<TRoute> = ExtractHonoSchema<TRoute> extends {
  input: infer TInput
  output: infer TOutput
}
  ? IsQuery<TRoute> extends true
    ? VisionQueryProcedure<TInput, TOutput>
    : VisionMutationProcedure<TInput, TOutput>
  : never

/**
 * Split path into segments
 * '/users/list' -> ['users', 'list']
 */
type SplitPath<T extends string> = T extends `/${infer Rest}`
  ? SplitSegments<Rest>
  : SplitSegments<T>

type SplitSegments<T extends string> = T extends `${infer First}/${infer Rest}`
  ? [First, ...SplitSegments<Rest>]
  : T extends ''
    ? []
    : [T]

/**
 * Build nested object from path segments
 * ['users', 'list'] -> { users: { list: TProcedure } }
 */
type BuildNested<TPath extends string[], TProcedure> = TPath extends [
  infer First extends string,
  ...infer Rest extends string[]
]
  ? { [K in First]: Rest extends [] ? TProcedure : BuildNested<Rest, TProcedure> }
  : TProcedure

/**
 * Merge nested objects
 */
type MergeNested<T, U> = {
  [K in keyof T | keyof U]: K extends keyof T
    ? K extends keyof U
      ? T[K] extends object
        ? U[K] extends object
          ? MergeNested<T[K], U[K]>
          : T[K]
        : T[K]
      : T[K]
    : K extends keyof U
      ? U[K]
      : never
}

/**
 * Infer router from Hono Schema
 */
export type InferHonoRouter<TSchema> = TSchema extends Record<string, any>
  ? UnionToIntersection<
      {
        [K in keyof TSchema]: K extends string
          ? BuildNested<SplitPath<K>, InferHonoProcedure<TSchema[K]>>
          : never
      }[keyof TSchema]
    >
  : {}

/**
 * Helper: Union to Intersection
 */
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never

/**
 * Check if type is Hono app
 */
export type IsHonoApp<T> = T extends { route: any; get: any; post: any } ? true : false

/**
 * Example usage:
 *
 * const app = new Hono()
 *   .get('/users/list', (c) => c.json([{ id: 1, name: 'John' }]))
 *   .post('/users/create', (c) => c.json({ id: 1, name: 'John' }))
 *
 * type Router = InferHonoRouter<typeof app>
 * // {
 * //   users: {
 * //     list: VisionQueryProcedure<void, User[]>
 * //     create: VisionMutationProcedure<CreateUserInput, User>
 * //   }
 * // }
 */
