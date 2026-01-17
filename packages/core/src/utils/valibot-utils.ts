import type { RequestBodySchema, SchemaField } from '../types'

// Valibot types (runtime detection only)
interface ValibotSchema {
  type: string
}

interface ValibotObjectSchema extends ValibotSchema {
  type: 'object'
  entries: Record<string, ValibotSchema>
}

interface ValibotOptionalSchema extends ValibotSchema {
  type: 'optional'
  wrapped: ValibotSchema
}

/**
 * Generate JSON template with comments from Valibot schema
 */
export function generateValibotTemplate(schema: any): RequestBodySchema | undefined {
  try {
    if (!isValibotSchema(schema)) return undefined

    const fields = extractValibotFields(schema)
    const template = generateJsonTemplate(fields)

    return { template, fields }
  } catch (error) {
    console.warn('Failed to generate template from Valibot schema:', error)
    return undefined
  }
}

function isValibotSchema(obj: any): obj is ValibotSchema {
  return obj && typeof obj === 'object' && 'type' in obj
}

function extractValibotFields(schema: ValibotSchema, path: string[] = []): SchemaField[] {
  const fields: SchemaField[] = []

  let currentSchema = schema
  if (schema.type === 'pipe') {
    const pipeSchema = schema as any
    if (pipeSchema.items && pipeSchema.items.length > 0) {
      currentSchema = pipeSchema.items[0]
    }
  }

  if (currentSchema.type === 'object') {
    const objSchema = currentSchema as ValibotObjectSchema
    const entries = objSchema.entries || {}

    for (const [key, value] of Object.entries(entries)) {
      const fieldSchema = value as ValibotSchema
      let isOptional = false
      let actualSchema = fieldSchema

      if (fieldSchema.type === 'optional') {
        isOptional = true
        actualSchema = (fieldSchema as ValibotOptionalSchema).wrapped
      }

      if (actualSchema.type === 'pipe') {
        const pipeSchema = actualSchema as any
        if (pipeSchema.items && pipeSchema.items.length > 0) {
          actualSchema = pipeSchema.items[0]
        }
      }

      let description: string | undefined
      const pipe = (fieldSchema as any).pipe
      if (fieldSchema.type === 'pipe' && pipe) {
        for (const pipeItem of pipe) {
          if (pipeItem?.type === 'description' && pipeItem.description) {
            description = pipeItem.description
            break
          }
          if (pipeItem?.type === 'metadata' && pipeItem.metadata) {
            const desc = pipeItem.metadata.find((m: any) => m.key === 'description')
            if (desc?.value) {
              description = desc.value
              break
            }
          }
        }
      }

      const fieldType = getValibotType(actualSchema)
      const nested = extractValibotFields(actualSchema, [...path, key])

      fields.push({
        name: key,
        type: fieldType,
        description,
        required: !isOptional,
        nested: nested.length > 0 ? nested : undefined,
        example: getValibotExample(fieldType),
      })
    }
  }

  return fields
}

function getValibotType(schema: ValibotSchema): string {
  switch (schema.type) {
    case 'string':
      return 'string'
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'array':
      return 'array'
    case 'object':
      return 'object'
    case 'enum':
      return 'enum'
    case 'date':
      return 'date'
    default:
      return 'any'
  }
}

function getValibotExample(type: string): any {
  switch (type) {
    case 'string':
      return ''
    case 'number':
      return 0
    case 'boolean':
      return false
    case 'array':
      return []
    case 'object':
      return {}
    default:
      return null
  }
}

function generateJsonTemplate(fields: SchemaField[], indent = 0): string {
  const lines: string[] = []
  const spacing = '  '.repeat(indent)

  lines.push('{')

  fields.forEach((field, index) => {
    const isLast = index === fields.length - 1

    if (field.description) {
      lines.push(`${spacing}  // ${field.description}`)
    }

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
