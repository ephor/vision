/**
 * Vision Client Code Generator
 * Automatically generates type-safe React Query client from discovered routes
 */

import type { RouteMetadata } from '../types'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'

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

      // Extract schemas from route metadata
      // Prefer raw schema if available, otherwise reconstruct from fields
      let inputSchema = 'z.void()'

      if (route.schema?.input) {
        // Use the actual Zod schema
        const serialized = serializeZodSchema(route.schema.input)
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

      const outputSchema = route.responseBody?.fields
        ? generateZodSchemaFromFields(route.responseBody.fields)
        : 'z.unknown()'

      // Add schema definitions
      const inputSchemaName = `${serviceName}_${procedureName}_input`
      const outputSchemaName = `${serviceName}_${procedureName}_output`

      if (includeValidation) {
        schemaDefinitions.push(`const ${inputSchemaName} = ${inputSchema}`)
        schemaDefinitions.push(`const ${outputSchemaName} = ${outputSchema}`)
      }

      // Add procedure definition
      procedures.push(`
    ${procedureName}: {
      method: '${route.method}' as const,
      path: '${route.path}',
      ${includeValidation ? `input: ${inputSchemaName},` : ''}
      ${includeValidation ? `output: ${outputSchemaName},` : ''}
    }`)
    }

    routeDefinitions.push(`
  ${serviceName}: {${procedures.join(',')}\n  }`)
  }

  // Generate routes object
  const routesCode = `
const routes = {${routeDefinitions.join(',')}\n} as const
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

export const api = createVisionClient(routes, {
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
          return `  ${key}: ${serializeZodSchema(value)}`
        })
        return `z.object({\n${fields.join(',\n')}\n})`
      }
      case 'string':
        return 'z.string()'
      case 'number':
        // Check for coerce in checks
        const hasCoerce = def.checks?.some((c: any) => c.kind === 'coerce' || c.kind === 'transform')
        return hasCoerce ? 'z.coerce.number()' : 'z.number()'
      case 'boolean':
        return 'z.boolean()'
      case 'array':
        return `z.array(${serializeZodSchema(def.element)})`
      case 'optional':
        return `${serializeZodSchema(def.value)}.optional()`
      case 'nullable':
        return `${serializeZodSchema(def.value)}.nullable()`
      case 'default':
        const defaultValue = typeof def.value === 'function' ? def.value() : def.value
        return `${serializeZodSchema(def.schema)}.default(${JSON.stringify(defaultValue)})`
      case 'enum':
        return `z.enum([${def.values?.map((v: string) => `'${v}'`).join(', ')}])`
      case 'literal':
        return `z.literal(${JSON.stringify(def.value)})`
      case 'union':
        return `z.union([${def.options?.map(serializeZodSchema).join(', ')}])`
      case 'record':
        return `z.record(${serializeZodSchema(def.valueType)})`
      case 'transform':
      case 'refine':
        return serializeZodSchema(def.schema)
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
          return `  ${key}: ${serializeZodSchema(value)}`
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
        return `z.array(${serializeZodSchema(def.type)})`
      case 'ZodOptional':
        return `${serializeZodSchema(def.innerType)}.optional()`
      case 'ZodNullable':
        return `${serializeZodSchema(def.innerType)}.nullable()`
      case 'ZodDefault': {
        const defaultValue = typeof def.defaultValue === 'function' ? def.defaultValue() : def.defaultValue
        return `${serializeZodSchema(def.innerType)}.default(${JSON.stringify(defaultValue)})`
      }
      case 'ZodEnum':
        return `z.enum([${def.values.map((v: string) => `'${v}'`).join(', ')}])`
      case 'ZodLiteral':
        return `z.literal(${JSON.stringify(def.value)})`
      case 'ZodUnion':
        return `z.union([${def.options.map(serializeZodSchema).join(', ')}])`
      case 'ZodRecord':
        return `z.record(${serializeZodSchema(def.valueType)})`
      case 'ZodEffects':
        return serializeZodSchema(def.schema)
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
