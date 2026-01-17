import type { StandardSchemaV1 } from './standard-schema'
import { isStandardSchema } from './standard-schema'
import { toStandardSchema as zodToStandard, isZodSchema } from './adapters/zod'
import { toStandardSchema as valibotToStandard, isValibotSchema } from './adapters/valibot'

export type ValidationSchema = StandardSchemaV1 | any // Can be Zod, Valibot, etc.

/**
 * Universal validator that accepts any Standard Schema-compliant validation library
 */
export class UniversalValidator {
  /**
   * Convert any supported schema to Standard Schema format
   */
  static toStandardSchema<T = unknown>(schema: ValidationSchema): StandardSchemaV1<T> {
    // Try Zod first (most specific check with _def)
    if (isZodSchema(schema)) {
      return zodToStandard(schema) as unknown as StandardSchemaV1<T>
    }

    // Try Valibot (has type and ~run/~standard but not _def)
    if (isValibotSchema(schema)) {
      return valibotToStandard(schema) as unknown as StandardSchemaV1<T>
    }

    // If it's already a Standard Schema, return as-is
    if (isStandardSchema(schema)) {
      return schema as StandardSchemaV1<T>
    }

    // If we can't identify the library, try to use it as Standard Schema directly
    if (schema && typeof schema === "object" && "~standard" in schema) {
      return schema as StandardSchemaV1<T>
    }

    throw new Error("Unsupported validation schema. Please use a library that implements Standard Schema v1.")
  }

  /**
   * Validate data using any supported schema
   */
  static validate<T>(
    schema: ValidationSchema,
    data: unknown
  ): StandardSchemaV1.Result<T> {
    const standardSchema = this.toStandardSchema<T>(schema)
    return standardSchema["~standard"].validate(data as T)
  }

  /**
   * Parse data - throws on validation error
   */
  static parse<T>(
    schema: ValidationSchema,
    data: unknown
  ): T {
    const result = this.validate<T>(schema, data)
    
    if (result.issues) {
      const error = new ValidationError("Validation failed", result.issues)
      throw error
    }
    
    return result.value as T
  }
}

/**
 * Custom validation error with detailed issues
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public issues: readonly StandardSchemaV1.Issue[]
  ) {
    super(message)
    this.name = "ValidationError"
  }
}
