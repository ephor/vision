import { zValidator as originalZValidator } from '@hono/zod-validator'
import type { ZodTypeAny } from 'zod'
import type { MiddlewareHandler } from 'hono'
import type { StandardSchemaV1, ValidationSchema } from '@getvision/core'
import {
  ValidationError,
  createValidationErrorResponse,
  UniversalValidator
} from '@getvision/core'

/**
 * Universal validator middleware for Hono that supports any Standard Schema-compliant library
 */
type ValidationTargetKey = 'json' | 'form' | 'query' | 'param' | 'header'

export function validator<Target extends ValidationTargetKey, S extends ZodTypeAny>(
  target: Target,
  schema: S
): MiddlewareHandler<
  any,
  any,
  {
    in: { [K in Target]: import('zod').infer<S> }
    out: { [K in Target]: import('zod').infer<S> }
  }
>

export function validator<Target extends ValidationTargetKey, S extends StandardSchemaV1<any, any>>(
  target: Target,
  schema: S
): MiddlewareHandler<
  any,
  any,
  {
    in: { [K in Target]: StandardSchemaV1.Infer<S>['output'] }
    out: { [K in Target]: StandardSchemaV1.Infer<S>['output'] }
  }
>

export function validator<Target extends ValidationTargetKey>(
  target: Target,
  schema: ValidationSchema
): MiddlewareHandler<
  any,
  any,
  {
    in: { [K in Target]: any }
    out: { [K in Target]: any }
  }
>

export function validator<Target extends ValidationTargetKey>(
  target: Target,
  schema: ValidationSchema
): MiddlewareHandler {
  const middleware: MiddlewareHandler = async (c, next) => {
    let data: unknown

    // Extract data based on target
    switch (target) {
      case 'json':
        data = await c.req.json().catch(() => ({}))
        break
      case 'form':
        data = await c.req.formData().catch(() => ({}))
        break
      case 'query':
        data = c.req.query()
        break
      case 'param':
        data = c.req.param()
        break
      case 'header':
        data = c.req.header()
        break
    }

    try {
      const validated = UniversalValidator.parse(schema, data)
      // Store in Hono's validation context
      c.set(`valid_${target}`, validated)
      await next()
    } catch (error) {
      if (error instanceof ValidationError) {
        const requestId = c.req.header('x-request-id')
        return c.json(
          createValidationErrorResponse(error.issues, requestId),
          400
        )
      }
      throw error
    }
  }

  // Attach schema and target for Vision introspection
  // Use Object.defineProperty to avoid potential setter issues
  try {
    Object.defineProperty(middleware, '__visionSchema', {
      value: schema,
      enumerable: true,
      writable: true,
      configurable: true
    })
    Object.defineProperty(middleware, '__visionValidatorTarget', {
      value: target,
      enumerable: true,
      writable: true,
      configurable: true
    })
  } catch (e) {
    console.error('Failed to attach schema to middleware:', e)
    console.log('Schema type:', typeof schema)
  }

  return middleware
}

/**
 * @deprecated Use validator() instead
 * Backward compatibility: Monkey-patch zValidator to attach schema for Vision introspection
 */
export const zValidator = new Proxy(originalZValidator, {
  apply(target, thisArg, args: any[]) {
    // Call original zValidator
    const validator = Reflect.apply(target, thisArg, args)
    
    // Attach schema (2nd argument) to the returned middleware handler
    const schema = args[1]
    if (schema && typeof schema === 'object' && '_def' in schema) {
      ;(validator as any).__visionSchema = schema
    }
    
    return validator
  }
})

/**
 * Declare response schema for Vision auto-codegen
 * Does not validate response (validation is optional, can be added in dev mode)
 *
 * @example
 * app.get('/users',
 *   validator('query', inputSchema),
 *   responseSchema(outputSchema),  // ← Declares output schema
 *   (c) => c.json({ users: [...] })
 * )
 */
export function responseSchema<S extends ValidationSchema>(
  schema: S
): MiddlewareHandler {
  const middleware: MiddlewareHandler = async (c, next) => {
    await next()
    // TODO: Optional response validation in dev mode
    // if (process.env.NODE_ENV === 'development') {
    //   const response = await c.res.clone().json()
    //   UniversalValidator.parse(schema, response)
    // }
  }

  // Attach schema for Vision introspection
  try {
    Object.defineProperty(middleware, '__visionResponseSchema', {
      value: schema,
      enumerable: true,
      writable: true,
      configurable: true
    })
  } catch (e) {
    console.error('Failed to attach response schema to middleware:', e)
  }

  return middleware
}

/**
 * Extract schema from validator middleware
 */
export function extractSchema(validator: any): ValidationSchema | undefined {
  return validator?.__visionSchema
}

/**
 * Extract response schema from middleware
 */
export function extractResponseSchema(middleware: any): ValidationSchema | undefined {
  return middleware?.__visionResponseSchema
}
