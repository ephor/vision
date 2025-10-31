import type { Request, Response, NextFunction, RequestHandler } from 'express'
import type { ZodSchema, ZodError } from 'zod'

// Store schemas for Vision introspection
const routeSchemas = new Map<string, { method: string; path: string; schema: ZodSchema }>()

/**
 * Get stored schema for a route
 */
export function getRouteSchema(method: string, path: string): ZodSchema | undefined {
  const key = `${method}:${path}`
  return routeSchemas.get(key)?.schema
}

/**
 * Get all stored schemas
 */
export function getAllRouteSchemas(): Map<string, { method: string; path: string; schema: ZodSchema }> {
  return routeSchemas
}

type ValidateTarget = 'body' | 'query' | 'params'

/**
 * Zod validator middleware for Express
 * Similar to @hono/zod-validator but stores schema for Vision introspection
 * 
 * @example
 * ```ts
 * import { zValidator } from '@getvision/adapter-express'
 * import { z } from 'zod'
 * 
 * const schema = z.object({
 *   name: z.string().describe('User name'),
 *   email: z.string().email().describe('User email'),
 * })
 * 
 * app.post('/users', zValidator('body', schema), (req, res) => {
 *   // req.body is now typed and validated
 *   const { name, email } = req.body
 *   res.json({ name, email })
 * })
 * ```
 */
export function zValidator<T extends ZodSchema>(
  target: ValidateTarget,
  schema: T
): RequestHandler {
  const middleware: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    // Store schema for Vision (we'll update it later with actual route info)
    const key = `${req.method}:${req.route?.path || req.path}`
    if (req.route?.path) {
      routeSchemas.set(key, {
        method: req.method,
        path: req.route.path,
        schema,
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

    // Validate data
    const result = schema.safeParse(data)

    if (!result.success) {
      // Validation failed
      const error = result.error as ZodError
      return res.status(400).json({
        error: 'Validation failed',
        issues: error.issues,
      })
    }

    // Store validated data back
    switch (target) {
      case 'body':
        req.body = result.data
        break
      case 'query':
        req.query = result.data as any
        break
      case 'params':
        req.params = result.data as any
        break
    }

    next()
  }
  
  // Attach schema to middleware for Vision introspection
  ;(middleware as any).__visionSchema = schema
  ;(middleware as any).__visionTarget = target
  
  return middleware
}

/**
 * Extract Zod schema from validator middleware
 * Used internally by Vision to generate API docs
 */
export function extractSchema(middleware: RequestHandler): ZodSchema | undefined {
  // This is a simplified version - in reality, we store schemas in the Map above
  return undefined
}
