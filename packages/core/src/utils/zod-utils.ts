import type { ZodType, ZodTypeAny } from 'zod'
import type { RequestBodySchema, SchemaField } from '../types/index'

/**
 * Generate JSON template with comments from Zod schema
 */
export function generateZodTemplate(schema: ZodType): RequestBodySchema | undefined {
  try {
    const fields = extractZodFields(schema)
    const template = generateJsonTemplate(fields)
    
    return {
      template,
      fields,
    }
  } catch (error) {
    console.warn('Failed to generate template from Zod schema:', error)
    return undefined
  }
}

/**
 * Extract fields from Zod schema (supports v3 and v4)
 */
function extractZodFields(schema: ZodTypeAny, path: string[] = []): SchemaField[] {
  const fields: SchemaField[] = []

  // Support both v3 (_def) and v4 (def)
  const def = (schema as any).def || (schema as any)._def
  if (!def) return fields

  // Unwrap ZodOptional, ZodNullable, ZodDefault - not needed for top level object
  let unwrapped: any = schema

  const currentDef = (unwrapped as any).def || (unwrapped as any)._def
  const typeName = currentDef?.type || currentDef?.typeName

  if (typeName === 'object' || typeName === 'ZodObject') {
    // Get shape - it can be a function (getter) or direct object
    const shapeValue = currentDef?.shape
    const shape = typeof shapeValue === 'function' ? shapeValue() : shapeValue
    
    for (const [key, value] of Object.entries(shape || {})) {
      const fieldSchema: any = value
      const fieldDef = fieldSchema.def || fieldSchema._def
      const isOptional = fieldSchema.type === 'optional' || 
                        fieldDef?.type === 'optional' ||
                        fieldDef?.typeName === 'ZodOptional' || 
                        fieldDef?.typeName === 'ZodDefault'
      
      // Get description - might be in wrapped schema for optional fields
      let description = fieldDef?.description || fieldSchema.description
      if (!description && fieldDef?.wrapped) {
        const wrappedDef = fieldDef.wrapped.def || fieldDef.wrapped._def
        description = wrappedDef?.description || fieldDef.wrapped.description
      }
      
      // Determine type
      let fieldType = getZodType(fieldSchema)
      
      // Check for nested objects/arrays
      const nested = extractZodFields(fieldSchema, [...path, key])
      
      fields.push({
        name: key,
        type: fieldType,
        description,
        required: !isOptional,
        nested: nested.length > 0 ? nested : undefined,
        example: getZodExample(fieldSchema, fieldType),
      })
    }
  }

  return fields
}

/**
 * Get Zod type as string (supports v3 and v4)
 */
function getZodType(schema: ZodTypeAny): string {
  let unwrapped: any = schema
  let def = (unwrapped as any).def || (unwrapped as any)._def
  
  // Unwrap optional/nullable/default
  while (def?.type === 'optional' || 
         def?.type === 'nullable' ||
         def?.type === 'default' ||
         def?.typeName === 'ZodOptional' || 
         def?.typeName === 'ZodNullable' ||
         def?.typeName === 'ZodDefault') {
    unwrapped = def?.innerType || def?.wrapped || unwrapped
    def = (unwrapped as any).def || (unwrapped as any)._def
  }

  // Support both v4 (type) and v3 (typeName)
  const typeName = def?.type || def?.typeName || (unwrapped as any).type
  
  switch (typeName) {
    case 'string':
    case 'ZodString': 
      return 'string'
    case 'number':
    case 'ZodNumber': 
      return 'number'
    case 'boolean':
    case 'ZodBoolean': 
      return 'boolean'
    case 'array':
    case 'ZodArray': 
      return 'array'
    case 'object':
    case 'ZodObject': 
      return 'object'
    case 'enum':
    case 'ZodEnum': 
      return 'enum'
    case 'date':
    case 'ZodDate': 
      return 'date'
    default: 
      return 'any'
  }
}

/**
 * Get example value for Zod type
 */
function getZodExample(_schema: ZodTypeAny, type: string): any {
  switch (type) {
    case 'string': return ''
    case 'number': return 0
    case 'boolean': return false
    case 'array': return []
    case 'object': return {}
    default: return null
  }
}

/**
 * Generate JSONC template with comments
 */
function generateJsonTemplate(fields: SchemaField[], indent = 0): string {
  const lines: string[] = []
  const spacing = '  '.repeat(indent)
  
  lines.push('{')
  
  fields.forEach((field, index) => {
    const isLast = index === fields.length - 1
    
    if (field.description) {
      lines.push(`${spacing}  // ${field.description}`)
    }
    
    // Add field
    let value: string
    if (field.nested && field.nested.length > 0) {
      value = generateJsonTemplate(field.nested, indent + 1)
    } else {
      value = JSON.stringify(field.example)
    }
    
    lines.push(`${spacing}  "${field.name}": ${value}${isLast ? '' : ','}`)
  })
  
  lines.push(`${spacing}}`)
  
  return lines.join('\n')
}
