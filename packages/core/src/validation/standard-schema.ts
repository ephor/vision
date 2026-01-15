/**
 * Standard Schema validation interface
 * Compatible with https://standardschema.dev/
 */

export interface StandardSchemaV1<TInput = unknown, TOutput = TInput> {
  "~standard": {
    version: 1
    vendor: string
    validate: (value: TInput) => StandardSchemaV1.Result<TOutput>
  }
}

export namespace StandardSchemaV1 {
  export interface Issue {
    path: readonly (string | number)[]
    message: string
  }

  export interface Result<T> {
    readonly issues?: readonly Issue[]
    readonly value?: T
  }

  export interface Infer<T> {
    readonly input: T extends StandardSchemaV1<infer I, any> ? I : never
    readonly output: T extends StandardSchemaV1<any, infer O> ? O : never
  }
}

/**
 * Validates data using Standard Schema interface
 */
export function validateWithStandard<T>(
  schema: StandardSchemaV1<T>,
  data: unknown
): StandardSchemaV1.Result<T> {
  return schema["~standard"].validate(data as T)
}

/**
 * Type guard to check if a schema implements Standard Schema
 */
export function isStandardSchema(obj: any): obj is StandardSchemaV1 {
  return (
    obj &&
    typeof obj === "object" &&
    "~standard" in obj &&
    typeof obj["~standard"] === "object" &&
    "version" in obj["~standard"] &&
    obj["~standard"].version === 1 &&
    "validate" in obj["~standard"] &&
    typeof obj["~standard"].validate === "function"
  )
}

/**
 * Convert Standard Schema issues to a more user-friendly format
 */
export function formatValidationIssues(issues: readonly StandardSchemaV1.Issue[]): {
  field: string
  message: string
  path: readonly (string | number)[]
}[] {
  return issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
    path: issue.path,
  }))
}
