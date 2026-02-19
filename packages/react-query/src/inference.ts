/**
 * Type inference for Vision React Query client
 * Extracts types from Vision Server or defineVisionContract
 */

import type { QueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query'
import type {
  ServiceBuilderToRouter,
  TransformEndpointsToRouter,
  InferZodType,
} from './vision-types'

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
  // Vision Server ServiceBuilder with _def.endpoints
  TAppOrContract extends { _def: { endpoints: infer TEndpoints } }
    ? InferFromServiceBuilder<TAppOrContract>
    : // Contract (defineVisionContract)
      TAppOrContract extends VisionContract
      ? InferContract<TAppOrContract>
      : // Vision Server with services
        TAppOrContract extends { _def: { services: infer TServices } }
        ? InferServices<TServices>
        : // Fallback: treat as raw routes (auto-generated from codegen)
          TAppOrContract

/**
 * Infer router from Vision Server ServiceBuilder
 * Transforms endpoints to nested service → procedure structure
 */
type InferFromServiceBuilder<T> = T extends { _def: { endpoints: infer TEndpoints } }
  ? TransformToClientRouter<TEndpoints>
  : never

/**
 * Transform endpoints map to client router with proper procedure types
 */
type TransformToClientRouter<TEndpoints> = {
  [TService in ExtractServices<TEndpoints>]: {
    [TProcedure in ExtractProcedures<TEndpoints, TService>]: GetProcedureClient<
      FindEndpoint<TEndpoints, TService, TProcedure>
    >
  }
}

/**
 * Extract unique service names from endpoints
 */
type ExtractServices<TEndpoints> = {
  [K in keyof TEndpoints]: TEndpoints[K] extends { path: infer P extends string }
    ? ExtractServiceName<P>
    : never
}[keyof TEndpoints]

/**
 * Extract service name from path (first segment)
 */
type ExtractServiceName<T extends string> = 
  T extends `/${infer Service}/${string}`
    ? Service
    : T extends `/${infer Service}`
      ? Service
      : never

/**
 * Extract procedure names for a service
 */
type ExtractProcedures<TEndpoints, TService extends string> = {
  [K in keyof TEndpoints]: TEndpoints[K] extends { path: infer P extends string }
    ? ExtractServiceName<P> extends TService
      ? PathToProcedure<P, TService>
      : never
    : never
}[keyof TEndpoints]

/**
 * Convert path to procedure name
 */
type PathToProcedure<TPath extends string, TService extends string> =
  TPath extends `/${TService}`
    ? 'list'
    : TPath extends `/${TService}/:${string}`
      ? 'byId'
      : TPath extends `/${TService}/${infer Rest}`
        ? Rest extends `${infer Name}/${string}`
          ? Name extends `:${string}` ? 'byId' : Name
          : Rest extends `:${string}` ? 'byId' : Rest
        : 'list'

/**
 * Find endpoint by service and procedure name
 */
type FindEndpoint<TEndpoints, TService extends string, TProcedure extends string> = {
  [K in keyof TEndpoints]: TEndpoints[K] extends { path: infer P extends string }
    ? ExtractServiceName<P> extends TService
      ? PathToProcedure<P, TService> extends TProcedure
        ? TEndpoints[K]
        : never
      : never
    : never
}[keyof TEndpoints]

/**
 * Get procedure client type from endpoint
 */
type GetProcedureClient<TEndpoint> = TEndpoint extends {
  method: infer M
  input: infer TInput
  output: infer TOutput
}
  ? M extends 'GET'
    ? VisionQueryProcedure<InferZodType<TInput>, InferZodType<TOutput>>
    : VisionMutationProcedure<InferZodType<TInput>, InferZodType<TOutput>>
  : never

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
  queryOptions: <TData = TOutput>(
    input: TInput,
    options?: Omit<UseQueryOptions<TOutput, Error, TData>, 'queryKey' | 'queryFn'>
  ) => UseQueryOptions<TOutput, Error, TData>

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
  mutationOptions: <TContext = unknown>(
    options?: Omit<UseMutationOptions<TOutput, Error, TInput, TContext>, 'mutationFn'>
  ) => UseMutationOptions<TOutput, Error, TInput, TContext>
}

/**
 * Vision client type
 */
/**
 * Procedure client with React Query methods
 */
export type ProcedureClient<TInput = any, TOutput = any> = {
  /**
   * Get query options for use with useQuery
   */
  queryOptions: (
    input?: TInput,
    options?: Omit<UseQueryOptions<TOutput, Error>, 'queryKey' | 'queryFn'>
  ) => UseQueryOptions<TOutput, Error>

  /**
   * Get mutation options for use with useMutation
   */
  mutationOptions: (
    options?: Omit<UseMutationOptions<TOutput, Error, TInput>, 'mutationFn'>
  ) => UseMutationOptions<TOutput, Error, TInput>

  /**
   * Prefetch query data
   */
  prefetch: (input?: TInput) => Promise<void>

  /**
   * Direct call (for imperative usage)
   */
  (input?: TInput): Promise<TOutput>
}

/**
 * Infer type from Zod schema or Standard Schema
 */
export type InferSchemaType<T> = T extends { _output: infer O }
  ? O
  : T extends { parse: (x: any) => infer O }
  ? O
  : T

/**
 * Convert route definition to procedure client
 * Extracts types from _types field (like tRPC $types)
 */
export type RouteToProcedure<TRoute> = TRoute extends {
  method: string
  _types: { input: infer I; output: infer O }
}
  ? ProcedureClient<I, O>
  : TRoute extends {
      method: string
      input?: infer I
      output?: infer O
    }
    ? ProcedureClient<InferSchemaType<I>, InferSchemaType<O>>
    : never

/**
 * Convert service (collection of routes) to client
 */
export type ServiceToClient<TService> = {
  [TKey in keyof TService]: RouteToProcedure<TService[TKey]>
}

/**
 * Vision client type
 */
export type VisionClient<TRouter> = {
  [TService in keyof TRouter]: ServiceToClient<TRouter[TService]>
} & {
  /**
   * Access to query client (for SSR, cache invalidation, etc.)
   */
  queryClient: QueryClient
}
