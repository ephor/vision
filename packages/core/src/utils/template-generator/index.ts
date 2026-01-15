import type { RequestBodySchema } from '../../types'
import type { StandardSchemaV1 } from '../../validation'
import { isStandardSchema, isZodSchema } from '../../validation'
import { generateZodTemplate as _generateZodTemplate } from '../zod-utils'

/**
 * Universal template generator that works with any validation library
 */
export function generateTemplate(schema: any): RequestBodySchema | undefined {
  if (!schema) return undefined

  // Try Standard Schema first
  if (isStandardSchema(schema)) {
    return generateStandardSchemaTemplate(schema)
  }

  // Try Zod
  if (isZodSchema(schema)) {
    return _generateZodTemplate(schema)
  }

  // Try Valibot
  if (isValibotSchema(schema)) {
    return generateValibotTemplate(schema)
  }

  // Unknown schema type
  console.warn('Unsupported schema type for template generation')
  return undefined
}

/**
 * Generate template for Zod schema (re-export for backward compatibility)
 */
export const generateZodTemplate = _generateZodTemplate

/**
 * Generate template for Standard Schema (limited introspection)
 */
function generateStandardSchemaTemplate(schema: StandardSchemaV1): RequestBodySchema | undefined {
  // Standard Schema only exposes validate() method, not structure
  // We can only provide a generic template
  return {
    template: '{\n  // Schema structure not available for Standard Schema\n}',
    fields: []
  }
}

/**
 * Generate template for Valibot schema
 */
function generateValibotTemplate(schema: any): RequestBodySchema | undefined {
  // For now, return generic template
  // TODO: Implement Valibot introspection if needed
  return {
    template: '{\n  // Valibot template generation not yet implemented\n}',
    fields: []
  }
}

/**
 * Check if schema is Valibot
 */
function isValibotSchema(obj: any): boolean {
  return obj && typeof obj === "object" && "type" in obj && "parse" in obj
}

/**
 * Registry for custom template generators
 */
const templateGenerators = new Map<string, (schema: any) => RequestBodySchema | undefined>()

/**
 * Register a custom template generator for a validation library
 */
export function registerTemplateGenerator(
  vendor: string,
  generator: (schema: any) => RequestBodySchema | undefined
): void {
  templateGenerators.set(vendor, generator)
}

/**
 * Get template generator for a vendor
 */
export function getTemplateGenerator(vendor: string) {
  return templateGenerators.get(vendor)
}

// Initialize with built-in generators
registerTemplateGenerator('zod', generateZodTemplate)
registerTemplateGenerator('valibot', generateValibotTemplate)
