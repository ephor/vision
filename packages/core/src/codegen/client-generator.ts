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
      const inputSchema = route.requestBody?.fields
        ? generateZodSchemaFromFields(route.requestBody.fields)
        : 'z.void()'

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
 * Generate Zod schema from field metadata
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
