import type { RequestBodySchema } from '../../types'
import type { StandardSchemaV1 } from '../../validation'
import { isStandardSchema, isZodSchema, isValibotSchema } from '../../validation'
import { generateZodTemplate as _generateZodTemplate } from '../zod-utils'
import { generateValibotTemplate as _generateValibotTemplate } from '../valibot-utils'

/**
 * Universal template generator that works with any validation library
 */
export function generateTemplate(schema: any): RequestBodySchema | undefined {
  if (!schema) return undefined

  // Try Zod
  if (isZodSchema(schema)) {
    return _generateZodTemplate(schema)
  }

  // Try Valibot
  if (isValibotSchema(schema)) {
    return _generateValibotTemplate(schema)
  }

  // Try Standard Schema as a fallback
  if (isStandardSchema(schema)) {
    return generateStandardSchemaTemplate(schema)
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
 * Generate template for Valibot schema (re-export for backward compatibility)
 */
export const generateValibotTemplate = _generateValibotTemplate

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
registerTemplateGenerator('valibot', _generateValibotTemplate)
