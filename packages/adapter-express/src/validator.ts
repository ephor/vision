import type { Request, Response, NextFunction, RequestHandler } from 'express'
import type { ZodTypeAny } from 'zod'
import type { StandardSchemaV1, ValidationSchema } from '@getvision/core'
import {
  ValidationError,
  createValidationErrorResponse,
  UniversalValidator
} from '@getvision/core'

// Store schemas for Vision introspection
const routeSchemas = new Map<string, { method: string; path: string; schema: ValidationSchema; target: string }>()

/**
 * Get stored schema for a route
 */
export function getRouteSchema(method: string, path: string): ValidationSchema | undefined {
  const key = `${method}:${path}`
  return routeSchemas.get(key)?.schema
}

/**
 * Get all stored schemas
 */
export function getAllRouteSchemas(): Map<string, { method: string; path: string; schema: ValidationSchema; target: string }> {
  return routeSchemas
}

type ValidateTarget = 'body' | 'query' | 'params'

/**
 * Universal validator middleware for Express that supports any Standard Schema-compliant library
 * 
 * @example
 * ```ts
 * import { validator } from '@getvision/adapter-express'
 * import { z } from 'zod'
 * 
 * const schema = z.object({
 *   name: z.string().describe('User name'),
 *   email: z.string().email().describe('User email'),
 * })
 * 
 * app.post('/users', validator('body', schema), (req, res) => {
 *   // req.body is now typed and validated
 *   const { name, email } = req.body
 *   res.json({ name, email })
 * })
 * ```
 */
export function validator<S extends ZodTypeAny>(
  target: 'body',
  schema: S
): RequestHandler<any, any, import('zod').infer<S>, any>

export function validator<S extends ZodTypeAny>(
  target: 'query',
  schema: S
): RequestHandler<any, any, any, import('zod').infer<S>>

export function validator<S extends ZodTypeAny>(
  target: 'params',
  schema: S
): RequestHandler<import('zod').infer<S>, any, any, any>

export function validator<S extends StandardSchemaV1<any, any>>(
  target: 'body',
  schema: S
): RequestHandler<any, any, StandardSchemaV1.Infer<S>['output'], any>

export function validator<S extends StandardSchemaV1<any, any>>(
  target: 'query',
  schema: S
): RequestHandler<any, any, any, StandardSchemaV1.Infer<S>['output']>

export function validator<S extends StandardSchemaV1<any, any>>(
  target: 'params',
  schema: S
): RequestHandler<StandardSchemaV1.Infer<S>['output'], any, any, any>

export function validator(
  target: ValidateTarget,
  schema: ValidationSchema
): RequestHandler {
  const middleware: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    // Store schema for Vision (we'll update it later with actual route info)
    const key = `${req.method}:${req.route?.path || req.path}`
    if (req.route?.path) {
      routeSchemas.set(key, {
        method: req.method,
        path: req.route.path,
        schema,
        target,
      })
    }

    // Get data to validate based on target
    let data: unknown
    switch (target) {
      case 'body':
        data = req.body
        break
      case 'query':
        data = req.query
        break
      case 'params':
        data = req.params
        break
      default:
        return next(new Error(`Invalid validation target: ${target}`))
    }

    try {
      // Validate data using UniversalValidator
      const validated = UniversalValidator.parse(schema, data)

      // Store validated data back
      switch (target) {
        case 'body':
          req.body = validated
          break
        case 'query':
          req.query = validated as any
          break
        case 'params':
          req.params = validated as any
          break
      }

      next()
    } catch (error) {
      if (error instanceof ValidationError) {
        const requestId = req.headers['x-request-id'] as string
        return res.status(400).json(
          createValidationErrorResponse(error.issues, requestId)
        )
      }
      next(error)
    }
  }
  
  // Attach schema to middleware for Vision introspection
  ;(middleware as any).__visionSchema = schema
  ;(middleware as any).__visionTarget = target
  
  return middleware
}
