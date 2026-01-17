import { describe, test, expect } from 'bun:test'
import { toStandardSchema } from '../valibot'
import * as v from 'valibot'

describe('Valibot Adapter', () => {
  test('converts simple object schema', () => {
    const schema = v.object({
      name: v.string(),
      age: v.number(),
    })

    const standard = toStandardSchema(schema)
    
    expect(standard['~standard'].vendor).toBe('valibot')
    expect(standard['~standard'].version).toBe(1)
  })

  test('handles validation errors with correct paths', () => {
    const schema = v.object({
      user: v.object({
        name: v.string(),
        profile: v.object({
          email: v.string(),
        }),
      }),
    })

    const standard = toStandardSchema(schema)
    const result = standard['~standard'].validate({
      user: {
        name: 123, // wrong type
        profile: {
          email: null, // wrong type
        },
      },
    })

    expect(result.issues?.length).toBeGreaterThan(0)
    // Check that paths are properly normalized
    expect(result.issues?.some(issue => issue.path.includes('name'))).toBe(true)
  })

  test('handles array validation errors', () => {
    const schema = v.object({
      items: v.array(v.object({ id: v.number() })),
    })

    const standard = toStandardSchema(schema)
    const result = standard['~standard'].validate({
      items: [
        { id: 'invalid' },
        { id: 2 },
      ],
    })

    expect(result.issues?.[0]?.path).toEqual(['items', 0, 'id'])
  })

  test('handles optional fields', () => {
    const schema = v.object({
      required: v.string(),
      optional: v.optional(v.string()),
    })

    const standard = toStandardSchema(schema)
    
    // Should validate without optional field
    const result1 = standard['~standard'].validate({
      required: 'value',
    })
    expect(result1.issues).toBeUndefined()

    // Should validate with optional field
    const result2 = standard['~standard'].validate({
      required: 'value',
      optional: 'optional',
    })
    expect(result2.issues).toBeUndefined()
  })

  test('handles pipe validations', () => {
    const schema = v.object({
      email: v.pipe(v.string(), v.email()),
      age: v.pipe(v.number(), v.minValue(18)),
    })

    const standard = toStandardSchema(schema)
    const result = standard['~standard'].validate({
      email: 'not-an-email',
      age: 16,
    })

    expect(result.issues?.length).toBe(2)
    expect(result.issues?.[0]?.path).toEqual(['email'])
    expect(result.issues?.[1]?.path).toEqual(['age'])
  })

  test('normalizes issue paths correctly', () => {
    // Test with different path formats Valibot might return
    const schema = v.object({
      nested: v.object({
        array: v.array(v.object({ value: v.string() })),
      }),
    })

    const standard = toStandardSchema(schema)
    const result = standard['~standard'].validate({
      nested: {
        array: [
          { value: 123 },
        ],
      },
    })

    expect(result.issues?.[0]?.path).toEqual(['nested', 'array', 0, 'value'])
  })

  test('handles union types', () => {
    const schema = v.object({
      value: v.union([v.string(), v.number()]),
    })

    const standard = toStandardSchema(schema)
    
    // Valid string
    const result1 = standard['~standard'].validate({ value: 'string' })
    expect(result1.issues).toBeUndefined()
    
    // Valid number
    const result2 = standard['~standard'].validate({ value: 123 })
    expect(result2.issues).toBeUndefined()
    
    // Invalid type
    const result3 = standard['~standard'].validate({ value: true })
    expect(result3.issues?.[0]?.path).toEqual(['value'])
  })

  test('preserves custom error messages', () => {
    const schema = v.object({
      age: v.pipe(
        v.number(),
        v.minValue(18, 'Must be at least 18 years old'),
      ),
    })

    const standard = toStandardSchema(schema)
    const result = standard['~standard'].validate({ age: 16 })

    expect(result.issues?.[0]?.message).toContain('Must be at least 18')
  })
})
