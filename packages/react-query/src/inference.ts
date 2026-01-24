/**
 * Type inference for Vision React Query client
 * Extracts types from Vision Server or defineVisionContract
 */

import type { QueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query'

/**
 * Contract definition (for adapters)
 */
export type VisionContract = Record<string, Record<string, VisionProcedure>>

export type VisionProcedure = {
  type: 'query' | 'mutation'
  input?: any
  output: any
  path?: string
  method?: string
}

/**
 * Extract router type from Vision Server, Contract, or Typed Routes
 */
export type InferVisionRouter<TAppOrContract> =
  // Typed routes (defineTypedRoutes)
  TAppOrContract extends Record<string, Record<string, { method: string; path: string }>>
    ? TAppOrContract
    : // Contract (defineVisionContract)
      TAppOrContract extends VisionContract
      ? InferContract<TAppOrContract>
      : // Vision Server
        TAppOrContract extends { _def: { services: infer TServices } }
        ? InferServices<TServices>
        : // Fallback: treat as-is
          TAppOrContract

/**
 * Infer from contract (adapters)
 */
type InferContract<TContract extends VisionContract> = {
  [TService in keyof TContract]: {
    [TProcedure in keyof TContract[TService]]: InferProcedure<
      TContract[TService][TProcedure]
    >
  }
}

/**
 * Infer from Vision Server
 */
type InferServices<TServices> = {
  [TService in keyof TServices]: TServices[TService] extends { _def: { procedures: infer TProcedures } }
    ? {
        [TProcedure in keyof TProcedures]: TProcedures[TProcedure] extends {
          _def: { type: infer TType; input: infer TInput; output: infer TOutput }
        }
          ? InferProcedure<{
              type: TType
              input: TInput
              output: TOutput
            }>
          : never
      }
    : never
}

/**
 * Infer procedure client
 */
type InferProcedure<TProcedure> = TProcedure extends { type: 'query'; input: infer TInput; output: infer TOutput }
  ? VisionQueryProcedure<TInput, TOutput>
  : TProcedure extends { type: 'mutation'; input: infer TInput; output: infer TOutput }
    ? VisionMutationProcedure<TInput, TOutput>
    : never

/**
 * Query procedure client (like tRPC)
 */
export type VisionQueryProcedure<TInput, TOutput> = {
  /**
   * Call query directly (for use outside React)
   * @example api.users.list({ limit: 10 })
   */
  (input: TInput): Promise<TOutput>

  /**
   * Get query options for React Query
   * @example useQuery(api.users.list.queryOptions({ limit: 10 }))
   */
  queryOptions: (
    input: TInput,
    options?: Omit<UseQueryOptions<TOutput, Error>, 'queryKey' | 'queryFn'>
  ) => UseQueryOptions<TOutput, Error>

  /**
   * Prefetch query (for SSR)
   * @example await api.users.list.prefetch({ limit: 10 })
   */
  prefetch: (input: TInput) => Promise<void>
}

/**
 * Mutation procedure client (like tRPC)
 */
export type VisionMutationProcedure<TInput, TOutput> = {
  /**
   * Call mutation directly (for use outside React)
   * @example api.users.create({ name: 'John' })
   */
  (input: TInput): Promise<TOutput>

  /**
   * Get mutation options for React Query
   * @example useMutation(api.users.create.mutationOptions())
   */
  mutationOptions: (
    options?: Omit<UseMutationOptions<TOutput, Error, TInput>, 'mutationFn'>
  ) => UseMutationOptions<TOutput, Error, TInput>
}

/**
 * Vision client type
 */
export type VisionClient<TRouter> = {
  [TService in keyof TRouter]: TRouter[TService]
} & {
  /**
   * Access to query client (for SSR, cache invalidation, etc.)
   */
  queryClient: QueryClient
}
