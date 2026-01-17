import { describe, test, expect } from 'bun:test'
import { generateTemplate, generateZodTemplate, generateValibotTemplate } from '../index'
import { isZodSchema, isValibotSchema } from '../../../validation'
import { z } from 'zod'
import * as v from 'valibot'

describe('Template Generation', () => {
  const zodSchema = z.object({
    name: z.string().min(1).describe('Full name'),
    email: z.string().email().describe('Email address'),
    age: z.number().int().positive().optional().describe('Age (optional)'),
  })

  const valibotSchema = v.object({
    name: v.pipe(v.string(), v.minLength(1), v.description('Full name')),
    email: v.pipe(v.string(), v.email(), v.description('Email address')),
    age: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.description('Age (optional)'))),
  })

  test('detects schemas correctly', () => {
    expect(isZodSchema(zodSchema)).toBe(true)
    expect(isValibotSchema(zodSchema)).toBe(false)
    expect(isValibotSchema(valibotSchema)).toBe(true)
    expect(isZodSchema(valibotSchema)).toBe(false)
  })

  test('generates zod template directly', () => {
    const result = generateZodTemplate(zodSchema)
    expect(result).toBeDefined()
    expect(result?.template).toContain('name')
    expect(result?.template).toContain('Full name')
    expect(result?.fields).toHaveLength(3)
    expect(result?.fields[0].name).toBe('name')
    expect(result?.fields[0].type).toBe('string')
    expect(result?.fields[0].description).toBe('Full name')
    expect(result?.fields[0].required).toBe(true)
  })

  test('generates valibot template directly', () => {
    const result = generateValibotTemplate(valibotSchema)
    expect(result).toBeDefined()
    expect(result?.template).toContain('name')
    expect(result?.fields).toHaveLength(3)
    expect(result?.fields[0].name).toBe('name')
    expect(result?.fields[0].type).toBe('string')
    expect(result?.fields[0].required).toBe(true)
  })

  test('generates templates through generateTemplate', () => {
    const zodResult = generateTemplate(zodSchema)
    expect(zodResult).toBeDefined()
    expect(zodResult?.template).not.toContain('Schema structure not available')
    expect(zodResult?.template).toContain('Full name')
    
    const valibotResult = generateTemplate(valibotSchema)
    expect(valibotResult).toBeDefined()
    expect(valibotResult?.template).not.toContain('Schema structure not available')
    expect(valibotResult?.template).toContain('name')
  })

  test('returns undefined for unknown schema', () => {
    const unknownSchema = { someProperty: 'value' }
    const result = generateTemplate(unknownSchema)
    expect(result).toBeUndefined()
  })
})
