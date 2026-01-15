import type { StandardSchemaV1 } from './standard-schema'

export interface ValidationErrorResponse {
  error: {
    code: 'VALIDATION_ERROR'
    message: string
    details: {
      field: string
      message: string
      path: readonly (string | number)[]
    }[]
  }
  timestamp: string
  requestId?: string
}

export interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: any
  }
  timestamp: string
  requestId?: string
}

/**
 * Creates a standardized validation error response
 */
export function createValidationErrorResponse(
  issues: readonly StandardSchemaV1.Issue[],
  requestId?: string
): ValidationErrorResponse {
  return {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
        path: issue.path
      }))
    },
    timestamp: new Date().toISOString(),
    requestId
  }
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
  code: string,
  message: string,
  details?: any,
  requestId?: string
): ErrorResponse {
  return {
    error: {
      code,
      message,
      details
    },
    timestamp: new Date().toISOString(),
    requestId
  }
}

/**
 * Common error codes
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  BAD_REQUEST: 'BAD_REQUEST'
} as const
