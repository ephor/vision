import type { FastifySchema, FastifyRequest, FastifyReply } from 'fastify'
import type { StandardSchemaV1, ValidationSchema } from '@getvision/core'
import {
  ValidationError,
  createValidationErrorResponse,
  UniversalValidator
} from '@getvision/core'

/**
 * Convert a Standard Schema to Fastify schema format
 * This allows using any validation library with Fastify's built-in validation
 */
export function toFastifySchema(schema: {
  body?: ValidationSchema
  querystring?: ValidationSchema
  params?: ValidationSchema
  headers?: ValidationSchema
  response?: {
    [statusCode: number]: ValidationSchema
  }
}): FastifySchema {
  const fastifySchema: FastifySchema = {}

  // Note: Fastify has its own validation system
  // This is a bridge to allow Standard Schema libraries to work with Fastify
  // In practice, you might want to use Fastify's native validation or override it

  return fastifySchema
}

/**
 * Universal validator for Fastify routes
 * 
 * @example
 * ```ts
 * import { validator } from '@getvision/adapter-fastify'
 * import { z } from 'zod'
 * 
 * const userSchema = z.object({
 *   name: z.string(),
 *   email: z.string().email()
 * })
 * 
 * fastify.post('/users', {
 *   preHandler: validator('body', userSchema)
 * }, async (request, reply) => {
 *   // request.body is now validated
 *   return { success: true }
 * })
 * ```
 */
export function validator<S extends import('zod').ZodTypeAny>(
  target: 'body',
  schema: S
): (request: FastifyRequest & { body: import('zod').infer<S> }, reply: FastifyReply) => Promise<void>

export function validator<S extends import('zod').ZodTypeAny>(
  target: 'querystring',
  schema: S
): (request: FastifyRequest & { query: import('zod').infer<S> }, reply: FastifyReply) => Promise<void>

export function validator<S extends import('zod').ZodTypeAny>(
  target: 'params',
  schema: S
): (request: FastifyRequest & { params: import('zod').infer<S> }, reply: FastifyReply) => Promise<void>

export function validator<S extends import('zod').ZodTypeAny>(
  target: 'headers',
  schema: S
): (request: FastifyRequest & { headers: import('zod').infer<S> }, reply: FastifyReply) => Promise<void>

export function validator<S extends StandardSchemaV1<any, any>>(
  target: 'body',
  schema: S
): (request: FastifyRequest & { body: StandardSchemaV1.Infer<S>['output'] }, reply: FastifyReply) => Promise<void>

export function validator<S extends StandardSchemaV1<any, any>>(
  target: 'querystring',
  schema: S
): (request: FastifyRequest & { query: StandardSchemaV1.Infer<S>['output'] }, reply: FastifyReply) => Promise<void>

export function validator<S extends StandardSchemaV1<any, any>>(
  target: 'params',
  schema: S
): (request: FastifyRequest & { params: StandardSchemaV1.Infer<S>['output'] }, reply: FastifyReply) => Promise<void>

export function validator<S extends StandardSchemaV1<any, any>>(
  target: 'headers',
  schema: S
): (request: FastifyRequest & { headers: StandardSchemaV1.Infer<S>['output'] }, reply: FastifyReply) => Promise<void>

export function validator(
  target: 'body',
  schema: ValidationSchema
): (request: FastifyRequest, reply: FastifyReply) => Promise<void>

export function validator(
  target: 'querystring',
  schema: ValidationSchema
): (request: FastifyRequest, reply: FastifyReply) => Promise<void>

export function validator(
  target: 'params',
  schema: ValidationSchema
): (request: FastifyRequest, reply: FastifyReply) => Promise<void>

export function validator(
  target: 'headers',
  schema: ValidationSchema
): (request: FastifyRequest, reply: FastifyReply) => Promise<void>

export function validator(
  target: 'body' | 'querystring' | 'params' | 'headers',
  schema: ValidationSchema
) {
  const handler = async (request: FastifyRequest, reply: FastifyReply) => {
    let data: unknown

    // Extract data based on target
    switch (target) {
      case 'body':
        data = request.body
        break
      case 'querystring':
        data = request.query
        break
      case 'params':
        data = request.params
        break
      case 'headers':
        data = request.headers
        break
    }

    try {
      // Validate data using UniversalValidator
      const validated = UniversalValidator.parse(schema, data)

      // Store validated data back
      switch (target) {
        case 'body':
          request.body = validated
          break
        case 'querystring':
          request.query = validated as any
          break
        case 'params':
          request.params = validated as any
          break
        case 'headers':
          // Fastify headers are read-only, but we can extend the request object
          Object.assign(request.headers, validated)
          break
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        const requestId = request.headers['x-request-id'] as string
        return reply.status(400).send(
          createValidationErrorResponse(error.issues, requestId)
        )
      }
      throw error
    }
  }

  (handler as any).__visionSchema = schema;
  (handler as any).__visionTarget = target;

  return handler
}

/**
 * Extract schema from route configuration
 */
export function extractSchema(routeOptions: any): ValidationSchema | undefined {
  return routeOptions?.schema?.__visionSchema
}
