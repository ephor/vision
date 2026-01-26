/**
 * Vision React Query Client
 * Auto-generated type-safe API client using shared schemas
 */

import { createVisionClient } from '@getvision/react-query'
import { routes, type User, type CreateUserInput } from '../shared/routes'

export const api = createVisionClient(routes, {
  baseUrl: 'http://localhost:3000',
  dashboardUrl: 'http://localhost:9500',

  // Optional: Add auth headers
  // headers: async () => ({
  //   authorization: `Bearer ${await getToken()}`
  // })
})

// Re-export types for components
export type { User, CreateUserInput }
