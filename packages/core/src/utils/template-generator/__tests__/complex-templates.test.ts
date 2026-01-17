import { describe, test, expect } from 'bun:test'
import { generateTemplate } from '../index'
import { z } from 'zod'
import * as v from 'valibot'

describe('Complex Template Generation', () => {
  describe('Nested Objects', () => {
    test('generates template for deeply nested Zod schema', () => {
      const schema = z.object({
        user: z.object({
          profile: z.object({
            personal: z.object({
              name: z.string().describe('Full name'),
              age: z.number().describe('Age'),
            }),
            contact: z.object({
              email: z.string().email().describe('Email'),
              phone: z.string().optional(),
            }),
          }),
        }),
      })

      const template = generateTemplate(schema)
      
      expect(template).toBeDefined()
      expect(template?.template).toContain('name')
      expect(template?.template).toContain('email')
      expect(template?.fields).toHaveLength(1)
      expect(template?.fields[0].name).toBe('user')
      expect(template?.fields[0].nested).toBeDefined()
    })

    test('generates template for nested Valibot schema', () => {
      const schema = v.object({
        settings: v.object({
          theme: v.pipe(v.picklist(['light', 'dark']), v.description('Theme preference')),
          notifications: v.object({
            email: v.boolean(),
            push: v.boolean(),
          }),
        }),
      })

      const template = generateTemplate(schema)
      
      expect(template).toBeDefined()
      expect(template?.template).toContain('theme')
      expect(template?.fields).toHaveLength(1)
      expect(template?.fields[0].name).toBe('settings')
    })
  })

  describe('Arrays', () => {
    test('generates template for Zod arrays', () => {
      const schema = z.object({
        tags: z.array(z.string()).describe('List of tags'),
        scores: z.array(z.number()).optional(),
      })

      const template = generateTemplate(schema)
      
      expect(template).toBeDefined()
      expect(template?.template).toContain('tags')
      expect(template?.fields).toHaveLength(2)
      expect(template?.fields[0].type).toBe('array')
    })

    test('generates template for array of objects', () => {
      const schema = z.object({
        users: z.array(z.object({
          id: z.number(),
          name: z.string(),
        })),
      })

      const template = generateTemplate(schema)
      
      expect(template).toBeDefined()
      expect(template?.template).toContain('users')
      expect(template?.fields[0].type).toBe('array')
    })

    test('handles Valibot arrays', () => {
      const schema = v.object({
        items: v.array(v.object({
          id: v.number(),
          name: v.string(),
        })),
      })

      const template = generateTemplate(schema)
      
      expect(template).toBeDefined()
      expect(template?.fields[0].type).toBe('array')
    })
  })

  describe('Complex Types', () => {
    test('handles Zod enums', () => {
      const schema = z.object({
        status: z.enum(['active', 'inactive', 'pending']).describe('Account status'),
      })

      const template = generateTemplate(schema)
      
      expect(template).toBeDefined()
      expect(template?.template).toContain('status')
      expect(template?.fields[0].type).toBe('enum')
    })

    test('handles Valibot enums', () => {
      const schema = v.object({
        role: v.picklist(['admin', 'user', 'guest']),
      })

      const template = generateTemplate(schema)
      
      expect(template).toBeDefined()
      expect(template?.fields[0].type).toBe('any')
    })

    test('handles union types in Zod', () => {
      const schema = z.object({
        value: z.union([z.string(), z.number(), z.boolean()]),
      })

      const template = generateTemplate(schema)
      
      expect(template).toBeDefined()
      expect(template?.fields[0].name).toBe('value')
    })

    test('handles literal types', () => {
      const schema = z.object({
        type: z.literal('USER'),
        active: z.literal(true),
      })

      const template = generateTemplate(schema)
      
      expect(template).toBeDefined()
      expect(template?.template).toContain('type')
      expect(template?.template).toContain('active')
    })
  })

  describe('Edge Cases', () => {
    test('handles optional nested objects', () => {
      const schema = z.object({
        required: z.string(),
        optional: z.optional(z.object({
          nested: z.string(),
        })),
      })

      const template = generateTemplate(schema)
      
      expect(template).toBeDefined()
      expect(template?.fields[1].required).toBe(false)
    })

    test('handles nullable fields', () => {
      const schema = z.object({
        value: z.string().nullable(),
      })

      const template = generateTemplate(schema)
      
      expect(template).toBeDefined()
      expect(template?.fields[0].name).toBe('value')
    })

    test('handles record types', () => {
      const schema = z.object({
        metadata: z.record(z.string(), z.string()),
      })

      const template = generateTemplate(schema)
      
      expect(template).toBeDefined()
      expect(template?.fields[0].name).toBe('metadata')
    })

    test('handles date fields', () => {
      const schema = z.object({
        createdAt: z.date().describe('Creation date'),
        updatedAt: z.date().optional(),
      })

      const template = generateTemplate(schema)
      
      expect(template).toBeDefined()
      expect(template?.fields[0].type).toBe('date')
    })

    test('handles Valibot date with pipe', () => {
      const schema = v.object({
        timestamp: v.pipe(v.date(), v.description('Timestamp')),
      })

      const template = generateTemplate(schema)
      
      expect(template).toBeDefined()
      expect(template?.fields[0].type).toBe('date')
    })
  })

  describe('Error Handling', () => {
    test('returns undefined for invalid schema', () => {
      const invalidSchema = { not: 'a-schema' }
      const template = generateTemplate(invalidSchema)
      expect(template).toBeUndefined()
    })

    test('handles null input', () => {
      const template = generateTemplate(null)
      expect(template).toBeUndefined()
    })

    test('handles undefined input', () => {
      const template = generateTemplate(undefined)
      expect(template).toBeUndefined()
    })
  })
})
