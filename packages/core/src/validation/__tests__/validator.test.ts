import { describe, test, expect } from 'bun:test'
import { UniversalValidator, ValidationError } from '../validator'
import { z } from 'zod'
import * as v from 'valibot'

describe('UniversalValidator', () => {
  const zodSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    age: z.number().optional(),
  })

  const valibotSchema = v.object({
    name: v.pipe(v.string(), v.minLength(1)),
    email: v.pipe(v.string(), v.email()),
    age: v.optional(v.number()),
  })

  test('validates with Zod schema', () => {
    const validData = { name: 'John', email: 'john@example.com', age: 30 }
    const result = UniversalValidator.validate(zodSchema, validData)
    
    expect(result.issues).toBeUndefined()
    expect(result.value).toEqual(validData)
  })

  test('validates with Valibot schema', () => {
    const validData = { name: 'John', email: 'john@example.com', age: 30 }
    const result = UniversalValidator.validate(valibotSchema, validData)
    
    expect(result.issues).toBeUndefined()
    expect(result.value).toEqual(validData)
  })

  test('returns validation errors for Zod', () => {
    const invalidData = { name: '', email: 'invalid', age: 'not-a-number' }
    const result = UniversalValidator.validate(zodSchema, invalidData)
    
    expect(result.issues).toBeDefined()
    expect(result.issues?.length).toBe(3)
    expect(result.issues?.[0]?.path).toEqual(['name'])
    expect(result.issues?.[1]?.path).toEqual(['email'])
    expect(result.issues?.[2]?.path).toEqual(['age'])
    expect(result.value).toBeUndefined()
  })

  test('returns validation errors for Valibot', () => {
    const invalidData = { name: '', email: 'invalid', age: 'not-a-number' }
    const result = UniversalValidator.validate(valibotSchema, invalidData)
    
    expect(result.issues).toBeDefined()
    expect(result.issues?.length).toBeGreaterThan(0)
    // Check that paths are properly normalized
    expect(result.issues?.some(issue => issue.path.includes('name'))).toBe(true)
    expect(result.value).toBeUndefined()
  })

  test('handles nested objects', () => {
    const nestedZodSchema = z.object({
      user: z.object({
        profile: z.object({
          name: z.string(),
          settings: z.object({
            theme: z.enum(['light', 'dark']),
          }),
        }),
      }),
    })

    const validData = {
      user: {
        profile: {
          name: 'John',
          settings: {
            theme: 'dark' as const,
          },
        },
      },
    }
    
    const result = UniversalValidator.validate(nestedZodSchema, validData)
    expect(result.issues).toBeUndefined()
    expect(result.value).toBeDefined()
  })

  test('handles arrays', () => {
    const arraySchema = z.object({
      items: z.array(z.object({ id: z.number(), name: z.string() })),
    })

    const validData = {
      items: [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ],
    }
    
    const result = UniversalValidator.validate(arraySchema, validData)
    expect(result.issues).toBeUndefined()
    expect(result.value).toEqual(validData)
    
    // Test invalid array
    const invalidData = {
      items: [
        { id: 'invalid', name: 'Item 1' },
      ],
    }
    
    const invalidResult = UniversalValidator.validate(arraySchema, invalidData)
    expect(invalidResult.issues).toBeDefined()
    expect(invalidResult.value).toBeUndefined()
  })

  test('converts schemas to Standard Schema', () => {
    const standardSchema = UniversalValidator.toStandardSchema(zodSchema)
    
    expect(standardSchema).toBeDefined()
    expect(standardSchema).toHaveProperty('~standard')
    expect(standardSchema['~standard']).toHaveProperty('version', 1)
    expect(standardSchema['~standard']).toHaveProperty('vendor', 'zod')
  })

  test('handles Standard Schema input', () => {
    const standardSchema = UniversalValidator.toStandardSchema(zodSchema)
    const validData = { name: 'John', email: 'john@example.com' }
    const result = UniversalValidator.validate(standardSchema, validData)
    
    expect(result.issues).toBeUndefined()
    expect(result.value).toEqual(validData)
  })

  test('parse throws on validation error', () => {
    const invalidData = { name: '', email: 'invalid' }
    
    expect(() => {
      UniversalValidator.parse(zodSchema, invalidData)
    }).toThrow(ValidationError)
  })

  test('parse returns valid data', () => {
    const validData = { name: 'John', email: 'john@example.com' }
    const result = UniversalValidator.parse(zodSchema, validData)
    
    expect(result).toEqual(validData)
  })

  test('throws error for unsupported schema', () => {
    const unsupportedSchema = { not: 'a-schema' }
    
    expect(() => {
      UniversalValidator.toStandardSchema(unsupportedSchema)
    }).toThrow('Unsupported validation schema')
  })
})
