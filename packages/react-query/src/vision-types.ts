/**
 * Type extraction utilities for Vision Server
 * Extracts endpoint types from ServiceBuilder for type-safe client generation
 */

import type { z } from 'zod'

/**
 * Infer type from Zod schema
 */
export type InferZodType<T> = T extends z.ZodType<infer O> ? O : T

/**
 * Extract endpoints map from ServiceBuilder
 */
export type ExtractEndpoints<T> = T extends { _def: { endpoints: infer E } } ? E : never

/**
 * Extract service name from ServiceBuilder
 */
export type ExtractServiceName<T> = T extends { _def: { serviceName: infer N } } ? N : never

/**
 * Extract path parameters from a path string
 * e.g., '/users/:id/posts/:postId' → 'id' | 'postId'
 */
export type ExtractPathParams<T extends string> = 
  T extends `${string}:${infer Param}/${infer Rest}`
    ? Param | ExtractPathParams<`/${Rest}`>
    : T extends `${string}:${infer Param}`
      ? Param
      : never

/**
 * Check if path has parameters
 */
export type HasPathParams<T extends string> = T extends `${string}:${string}` ? true : false

/**
 * Extract the last segment of a path for procedure naming
 * e.g., '/users/list' → 'list', '/users/:id' → ':id'
 */
export type ExtractLastSegment<T extends string> = 
  T extends `${string}/${infer Rest}`
    ? Rest extends `${string}/${string}`
      ? ExtractLastSegment<`/${Rest}`>
      : Rest
    : T

/**
 * Convert path to procedure name
 * Rules:
 * - '/users' → 'list' (root of service)
 * - '/users/:id' → 'byId' (single param at end)
 * - '/users/create' → 'create' (explicit action)
 * - '/users/:id/articles' → 'articles' (nested resource)
 */
export type PathToProcedureName<TPath extends string, TServicePath extends string> =
  // If path equals service path, it's the list endpoint
  TPath extends TServicePath
    ? 'list'
    // If path ends with :param, use 'byId'
    : ExtractLastSegment<TPath> extends `:${string}`
      ? 'byId'
      // Otherwise use the last segment as procedure name
      : ExtractLastSegment<TPath>

/**
 * Extract service path (first segment after leading slash)
 * e.g., '/users/:id' → '/users', '/api/users/list' → '/api'
 */
export type ExtractServicePath<T extends string> = 
  T extends `/${infer Service}/${string}`
    ? `/${Service}`
    : T

/**
 * Extract service name from path
 * e.g., '/users/:id' → 'users'
 */
export type ExtractServiceNameFromPath<T extends string> = 
  T extends `/${infer Service}/${string}`
    ? Service
    : T extends `/${infer Service}`
      ? Service
      : never

/**
 * Group endpoints by service name
 * Transforms flat endpoint map into nested service → procedure structure
 */
export type GroupEndpointsByService<TEndpoints> = {
  [TService in UniqueServices<TEndpoints>]: {
    [TKey in keyof TEndpoints as TEndpoints[TKey] extends { path: infer P extends string }
      ? ExtractServiceNameFromPath<P> extends TService
        ? PathToProcedureName<P, `/${TService}`>
        : never
      : never
    ]: TEndpoints[TKey]
  }
}

/**
 * Get unique service names from endpoints
 */
export type UniqueServices<TEndpoints> = TEndpoints[keyof TEndpoints] extends { path: infer P extends string }
  ? ExtractServiceNameFromPath<P>
  : never

/**
 * Convert endpoint definition to procedure type for client
 */
export type EndpointToProcedure<TEndpoint, TProcedureTypes> = 
  TEndpoint extends { method: infer M; input: infer TInput; output: infer TOutput }
    ? M extends 'GET'
      ? TProcedureTypes extends { query: infer Q }
        ? Q extends new (input: any, output: any) => infer R
          ? R
          : CreateQueryProcedure<InferZodType<TInput>, InferZodType<TOutput>>
        : CreateQueryProcedure<InferZodType<TInput>, InferZodType<TOutput>>
      : TProcedureTypes extends { mutation: infer M }
        ? M extends new (input: any, output: any) => infer R
          ? R
          : CreateMutationProcedure<InferZodType<TInput>, InferZodType<TOutput>>
        : CreateMutationProcedure<InferZodType<TInput>, InferZodType<TOutput>>
    : never

/**
 * Placeholder types - actual implementation in inference.ts
 */
export type CreateQueryProcedure<TInput, TOutput> = {
  _type: 'query'
  _input: TInput
  _output: TOutput
}

export type CreateMutationProcedure<TInput, TOutput> = {
  _type: 'mutation'
  _input: TInput
  _output: TOutput
}

/**
 * Transform ServiceBuilder endpoints to client router type
 */
export type ServiceBuilderToRouter<T> = T extends { _def: { endpoints: infer TEndpoints } }
  ? TransformEndpointsToRouter<TEndpoints>
  : never

/**
 * Transform flat endpoints map to nested router structure
 */
export type TransformEndpointsToRouter<TEndpoints> = {
  [TService in ExtractAllServices<TEndpoints>]: {
    [TProcedure in ExtractProceduresForService<TEndpoints, TService>]: ExtractProcedureType<
      TEndpoints,
      TService,
      TProcedure
    >
  }
}

/**
 * Extract all unique service names from endpoints
 */
export type ExtractAllServices<TEndpoints> = {
  [K in keyof TEndpoints]: TEndpoints[K] extends { path: infer P extends string }
    ? ExtractServiceNameFromPath<P>
    : never
}[keyof TEndpoints]

/**
 * Extract procedure names for a specific service
 */
export type ExtractProceduresForService<TEndpoints, TService extends string> = {
  [K in keyof TEndpoints]: TEndpoints[K] extends { path: infer P extends string }
    ? ExtractServiceNameFromPath<P> extends TService
      ? PathToProcedureName<P, `/${TService}`>
      : never
    : never
}[keyof TEndpoints]

/**
 * Extract procedure type for a specific service and procedure name
 */
export type ExtractProcedureType<TEndpoints, TService extends string, TProcedure extends string> = {
  [K in keyof TEndpoints]: TEndpoints[K] extends { 
    path: infer P extends string
    method: infer M extends string
    input: infer TInput
    output: infer TOutput
  }
    ? ExtractServiceNameFromPath<P> extends TService
      ? PathToProcedureName<P, `/${TService}`> extends TProcedure
        ? {
            method: M
            path: P
            input: InferZodType<TInput>
            output: InferZodType<TOutput>
          }
        : never
      : never
    : never
}[keyof TEndpoints]
