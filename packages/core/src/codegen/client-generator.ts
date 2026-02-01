/**
 * Vision Client Code Generator
 * Automatically generates type-safe React Query client from discovered routes
 */

import type { RouteMetadata } from '../types'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { isZodSchema } from '../validation/adapters/zod'
import { isValibotSchema } from '../validation/adapters/valibot'

export interface ClientGeneratorOptions {
  /**
   * Output file path for generated client
   * @example './src/api/generated.ts'
   */
  output: string

  /**
   * Base URL for API (optional, can be set at runtime)
   */
  baseUrl?: string

  /**
   * Include runtime validation (default: true)
   */
  includeValidation?: boolean

  /**
   * Framework for generated code
   */
  framework?: 'react-query' | 'vanilla'
}

/**
 * Generate TypeScript client code from routes metadata
 */
export function generateClient(routes: RouteMetadata[], options: ClientGeneratorOptions): string {
  const { baseUrl, includeValidation = true, framework = 'react-query' } = options

  // Group routes by service
  const serviceMap = new Map<string, RouteMetadata[]>()

  for (const route of routes) {
    // Extract service name from path: /users/list → users
    const segments = route.path.split('/').filter(Boolean)
    const serviceName = segments[0] || 'root'

    if (!serviceMap.has(serviceName)) {
      serviceMap.set(serviceName, [])
    }
    serviceMap.get(serviceName)!.push(route)
  }

  // Generate imports
  const imports = [
    `import { createVisionClient } from '@getvision/react-query'`,
    includeValidation ? `import { z } from 'zod'` : '',
  ].filter(Boolean)

  // Generate schemas from route metadata
  const schemaDefinitions: string[] = []
  const routeDefinitions: string[] = []

  for (const [serviceName, serviceRoutes] of serviceMap) {
    const procedures: string[] = []

    for (const route of serviceRoutes) {
      // Generate procedure name: /users/list → list
      const pathSegments = route.path.split('/').filter(Boolean)
      const procedureName = pathSegments[pathSegments.length - 1].replace(/[:-]/g, '_')

      // Extract input schema
      let inputSchema = 'z.void()'

      if (route.schema?.input) {
        // Use the actual schema (Zod, Valibot, or other)
        const serialized = serializeSchema(route.schema.input)
        if (serialized !== 'z.unknown()') {
          inputSchema = serialized
        } else {
          // Serialization failed, try fields fallback
          const inputFields = route.method === 'GET'
            ? route.queryParams?.fields
            : route.requestBody?.fields

          if (inputFields) {
            inputSchema = generateZodSchemaFromFields(inputFields)
          }
        }
      } else {
        // Fall back to reconstructing from fields
        const inputFields = route.method === 'GET'
          ? route.queryParams?.fields
          : route.requestBody?.fields

        if (inputFields) {
          inputSchema = generateZodSchemaFromFields(inputFields)
        }
      }

      // Extract output schema
      let outputSchema = 'z.unknown()'

      if (route.schema?.output) {
        // Use the actual response schema (Zod, Valibot, or other)
        const serialized = serializeSchema(route.schema.output)
        if (serialized !== 'z.unknown()') {
          outputSchema = serialized
        } else {
          // Serialization failed, try fields fallback
          if (route.responseBody?.fields) {
            outputSchema = generateZodSchemaFromFields(route.responseBody.fields)
          }
        }
      } else if (route.responseBody?.fields) {
        // Fall back to reconstructing from fields
        outputSchema = generateZodSchemaFromFields(route.responseBody.fields)
      }

      // Add schema definitions
      const inputSchemaName = `${serviceName}_${procedureName}_input`
      const outputSchemaName = `${serviceName}_${procedureName}_output`

      if (includeValidation) {
        schemaDefinitions.push(`const ${inputSchemaName} = ${inputSchema}`)
        schemaDefinitions.push(`const ${outputSchemaName} = ${outputSchema}`)
      }

      // Add procedure definition (with _types for type inference like tRPC)
      procedures.push(`
    ${procedureName}: {
      method: '${route.method}' as const,
      path: '${route.path}',
      ${includeValidation ? `input: ${inputSchemaName},` : ''}
      ${includeValidation ? `output: ${outputSchemaName},` : ''}
      _types: {} as {
        input: z.infer<typeof ${inputSchemaName}>,
        output: z.infer<typeof ${outputSchemaName}>
      }
    }`)
    }

    routeDefinitions.push(`
  ${serviceName}: {${procedures.join(',')}\n  }`)
  }

  // Generate routes object
  const routesCode = `
const routes = {${routeDefinitions.join(',')}\n}
`

  // Generate client initialization
  const clientCode = `
/**
 * Auto-generated Vision React Query client
 * Generated at: ${new Date().toISOString()}
 *
 * DO NOT EDIT MANUALLY - This file is auto-generated
 * Edit your server routes and restart to regenerate
 */

export const api = createVisionClient<typeof routes>(routes, {
  baseUrl: ${baseUrl ? `'${baseUrl}'` : "process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'"}
})

// Type exports
${generateTypeExports(serviceMap)}
`

  // Combine all parts
  return [
    '/**',
    ' * Auto-generated Vision React Query Client',
    ' * @generated',
    ' * DO NOT EDIT MANUALLY',
    ' */',
    '',
    ...imports,
    '',
    ...schemaDefinitions,
    '',
    routesCode,
    '',
    clientCode,
  ].join('\n')
}

/**
 * Serialize any validation schema to Zod TypeScript code
 * Supports Zod (v3/v4), Valibot, and Standard Schema
 */
function serializeSchema(schema: any): string {
  // Detect schema library
  if (isZodSchema(schema)) {
    return serializeZodSchema(schema)
  }

  if (isValibotSchema(schema)) {
    return serializeValibotSchema(schema)
  }

  // Fallback to unknown
  return 'z.unknown()'
}

/**
 * Serialize Valibot schema to Zod TypeScript code
 * Converts Valibot schemas to equivalent Zod syntax
 */
function serializeValibotSchema(schema: any): string {
  if (!schema || typeof schema !== 'object') {
    return 'z.unknown()'
  }

  const type = schema.type

  switch (type) {
    case 'object': {
      const entries = schema.entries || {}
      const fields = Object.entries(entries).map(([key, value]: [string, any]) => {
        return `  ${key}: ${serializeSchema(value)}`
      })
      return `z.object({\n${fields.join(',\n')}\n})`
    }
    case 'string':
      return 'z.string()'
    case 'number':
      return 'z.coerce.number()'
    case 'boolean':
      return 'z.boolean()'
    case 'array':
      return `z.array(${serializeSchema(schema.item)})`
    case 'optional':
      return `${serializeSchema(schema.wrapped)}.optional()`
    case 'nullable':
      return `${serializeSchema(schema.wrapped)}.nullable()`
    case 'union':
      return `z.union([${schema.options?.map(serializeSchema).join(', ')}])`
    case 'literal':
      return `z.literal(${JSON.stringify(schema.literal)})`
    case 'picklist':
      // Valibot's picklist is like Zod's enum
      return `z.enum([${schema.options?.map((v: string) => `'${v}'`).join(', ')}])`
    default:
      console.warn(`Unknown Valibot type: ${type}`)
      return 'z.unknown()'
  }
}

/**
 * Serialize Zod schema to TypeScript code
 * Supports both Zod v3 (_def.typeName) and Zod v4 (def.type)
 */
function serializeZodSchema(schema: any): string {
  if (!schema || typeof schema !== 'object') {
    return 'z.unknown()'
  }

  // Zod v4 uses 'def' with 'type' property
  if ('def' in schema && schema.def?.type) {
    const def = schema.def
    const type = def.type

    switch (type) {
      case 'object': {
        const shape = def.shape || {}
        const fields = Object.entries(shape).map(([key, value]: [string, any]) => {
          return `  ${key}: ${serializeSchema(value)}`
        })
        return `z.object({\n${fields.join(',\n')}\n})`
      }
      case 'string':
        return 'z.string()'
      case 'number':
        // Check for coerce flag (Zod v4 has explicit coerce field)
        const hasCoerce = def.coerce === true || def.checks?.some((c: any) => c.kind === 'coerce' || c.kind === 'transform')
        return hasCoerce ? 'z.coerce.number()' : 'z.number()'
      case 'boolean':
        return 'z.boolean()'
      case 'array':
        return `z.array(${serializeSchema(def.element)})`
      case 'optional':
        // Zod v4 uses 'innerType' instead of 'value'
        return `${serializeSchema(def.innerType || def.value)}.optional()`
      case 'nullable':
        // Zod v4 uses 'innerType' instead of 'value'
        return `${serializeSchema(def.innerType || def.value)}.nullable()`
      case 'default': {
        // Zod v4 uses defaultValue field
        const defaultValue = typeof def.defaultValue === 'function' ? def.defaultValue() : def.defaultValue
        // Zod v4 uses innerType for wrapped schema
        const innerSchema = def.innerType ? serializeSchema(def.innerType) : 'z.unknown()'
        return `${innerSchema}.default(${JSON.stringify(defaultValue)})`
      }
      case 'enum':
        return `z.enum([${def.values?.map((v: string) => `'${v}'`).join(', ')}])`
      case 'literal':
        return `z.literal(${JSON.stringify(def.value)})`
      case 'union':
        return `z.union([${def.options?.map(serializeSchema).join(', ')}])`
      case 'record':
        return `z.record(${serializeSchema(def.valueType)})`
      case 'transform':
      case 'refine':
        return serializeSchema(def.schema)
      default:
        console.warn(`Unknown Zod v4 type: ${type}`)
        return 'z.unknown()'
    }
  }

  // Zod v3 uses '_def' with 'typeName' property
  if ('_def' in schema) {
    const def = schema._def
    const typeName = def.typeName

    switch (typeName) {
      case 'ZodObject': {
        const shape = schema.shape || schema._def.shape()
        const fields = Object.entries(shape).map(([key, value]: [string, any]) => {
          return `  ${key}: ${serializeSchema(value)}`
        })
        return `z.object({\n${fields.join(',\n')}\n})`
      }
      case 'ZodString':
        return 'z.string()'
      case 'ZodNumber':
        return 'z.coerce.number()'
      case 'ZodBoolean':
        return 'z.boolean()'
      case 'ZodArray':
        return `z.array(${serializeSchema(def.type)})`
      case 'ZodOptional':
        return `${serializeSchema(def.innerType)}.optional()`
      case 'ZodNullable':
        return `${serializeSchema(def.innerType)}.nullable()`
      case 'ZodDefault': {
        const defaultValue = typeof def.defaultValue === 'function' ? def.defaultValue() : def.defaultValue
        return `${serializeSchema(def.innerType)}.default(${JSON.stringify(defaultValue)})`
      }
      case 'ZodEnum':
        return `z.enum([${def.values.map((v: string) => `'${v}'`).join(', ')}])`
      case 'ZodLiteral':
        return `z.literal(${JSON.stringify(def.value)})`
      case 'ZodUnion':
        return `z.union([${def.options.map(serializeSchema).join(', ')}])`
      case 'ZodRecord':
        return `z.record(${serializeSchema(def.valueType)})`
      case 'ZodEffects':
        // ZodEffects wraps another schema (used for .refine(), .transform(), .email(), etc.)
        if (def.schema) {
          return serializeSchema(def.schema)
        }
        // Fallback to inner type if available
        if (schema._def?.schema) {
          return serializeSchema(schema._def.schema)
        }
        console.warn(`Unknown ZodEffects without schema`)
        return 'z.unknown()'
      default:
        console.warn(`Unknown Zod v3 type: ${typeName}`)
        return 'z.unknown()'
    }
  }

  return 'z.unknown()'
}

/**
 * Generate Zod schema from field metadata (fallback)
 */
function generateZodSchemaFromFields(fields: any[]): string {
  const fieldSchemas = fields.map(field => {
    let schema = `z.${field.type}()`

    if (!field.required) {
      schema += '.optional()'
    }

    return `  ${field.name}: ${schema}`
  })

  return `z.object({\n${fieldSchemas.join(',\n')}\n})`
}

/**
 * Generate type exports
 */
function generateTypeExports(serviceMap: Map<string, RouteMetadata[]>): string {
  const exports: string[] = []

  for (const [serviceName, serviceRoutes] of serviceMap) {
    for (const route of serviceRoutes) {
      const pathSegments = route.path.split('/').filter(Boolean)
      const procedureName = pathSegments[pathSegments.length - 1].replace(/[:-]/g, '_')
      const typeName = `${capitalize(serviceName)}${capitalize(procedureName)}`

      const inputSchemaName = `${serviceName}_${procedureName}_input`
      const outputSchemaName = `${serviceName}_${procedureName}_output`

      exports.push(`export type ${typeName}Input = z.infer<typeof ${inputSchemaName}>`)
      exports.push(`export type ${typeName}Output = z.infer<typeof ${outputSchemaName}>`)
    }

    // Export singular entity type (e.g., User from users service)
    // Find route that returns a single entity (usually has :id param)
    const singularName = capitalize(serviceName.replace(/s$/, ''))
    const singleEntityRoute = serviceRoutes.find(r => r.path.includes(':id') && !r.path.includes('update') && !r.path.includes('delete'))
    if (singleEntityRoute) {
      const pathSegments = singleEntityRoute.path.split('/').filter(Boolean)
      const procedureName = pathSegments[pathSegments.length - 1].replace(/[:-]/g, '_')
      const outputSchemaName = `${serviceName}_${procedureName}_output`

      // Export singular entity type
      exports.push(`export type ${singularName} = z.infer<typeof ${outputSchemaName}>`)
    }
  }

  return exports.join('\n')
}

/**
 * Write generated client to file
 */
export function writeGeneratedClient(
  routes: RouteMetadata[],
  options: ClientGeneratorOptions
): void {
  const code = generateClient(routes, options)

  // Ensure directory exists
  const dir = dirname(options.output)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  // Write file
  writeFileSync(options.output, code, 'utf-8')

  console.log(`✅ Generated Vision client: ${options.output}`)
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
