import { zValidator as originalZValidator } from '@hono/zod-validator'
import type { ZodType } from 'zod'

/**
 * Monkey-patch zValidator to attach schema for Vision introspection
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
 * Extract schema from validator middleware
 */
export function extractSchema(validator: any): ZodType | undefined {
  return validator?.__visionSchema
}
