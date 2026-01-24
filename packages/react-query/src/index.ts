/**
 * @getvision/react-query
 * Type-safe React Query client for Vision
 * tRPC-like DX for REST APIs
 */

// Client
export { createVisionClient } from './client'
export type { VisionClientConfig } from './client'

// Typed routes (for compile-time type safety)
export { defineTypedRoutes } from './typed-routes'
export type { InferInput, InferOutput } from './typed-routes'

// Contract (for adapters)
export { defineVisionContract, query, mutation } from './contract'

// Type inference
export type {
  VisionContract,
  VisionProcedure,
  VisionClient,
  VisionQueryProcedure,
  VisionMutationProcedure,
  InferVisionRouter,
} from './inference'
