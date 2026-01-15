import { z } from 'zod'
import type { StandardSchemaV1 } from '../standard-schema'

/**
 * Convert Zod schema to Standard Schema
 */
export function toStandardSchema<T extends z.ZodType>(
  zodSchema: T
): StandardSchemaV1<z.input<T>, z.output<T>> {
  return {
    "~standard": {
      version: 1,
      vendor: "zod",
      validate: (value: z.input<T>) => {
        const result = zodSchema.safeParse(value)
        
        if (result.success) {
          return { value: result.data }
        }
        
        return {
          issues: result.error.issues.map((issue) => ({
            path: issue.path.map(p => typeof p === 'string' || typeof p === 'number' ? p : String(p)),
            message: issue.message,
          })),
        }
      },
    },
  }
}

/**
 * Check if a schema is a Zod schema
 */
export function isZodSchema(obj: any): obj is z.ZodType {
  return obj && typeof obj === "object" && "_def" in obj && "parse" in obj
}
