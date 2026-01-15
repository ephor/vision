// Valibot adapter - only available if valibot is installed
// This file will be ignored if valibot is not a dependency

try {
  var v = require('valibot')
} catch (e) {
  // Valibot not installed, module will be undefined
  var v = undefined
}

import type { StandardSchemaV1 } from '../standard-schema'

/**
 * Convert Valibot schema to Standard Schema
 */
export function toStandardSchema<TInput = unknown, TOutput = TInput>(
  valibotSchema: any
): StandardSchemaV1<TInput, TOutput> {
  if (!v) {
    throw new Error('Valibot is not installed. Please install it with: npm install valibot')
  }

  return {
    "~standard": {
      version: 1,
      vendor: "valibot",
      validate: (value: TInput) => {
        const result = v.safeParse(valibotSchema, value)
        
        if (result.success) {
          return { value: result.output }
        }
        
        return {
          issues: result.issues.map((issue: any) => ({
            path: v.getIssuePath(issue),
            message: issue.message,
          })),
        }
      },
    },
  }
}

/**
 * Check if a schema is a Valibot schema
 */
export function isValibotSchema(obj: any): obj is any {
  return obj && typeof obj === "object" && "type" in obj && "parse" in obj
}
