# Universal Template Generator

The template generator creates API documentation templates from validation schemas. It supports multiple validation libraries and can be extended for custom libraries.

## Usage

```typescript
import { generateTemplate } from '@getvision/core'
import { z } from 'zod'
import * as v from 'valibot'

// Works with any supported library
const zodTemplate = generateTemplate(z.object({ name: z.string() }))
const valibotTemplate = generateTemplate(v.object({ name: v.string() }))
```

## Supported Libraries

### Zod
- Full introspection support
- Generates detailed templates with field descriptions

### Valibot
- Basic support (returns generic template)
- Can be extended with custom generator

### Standard Schema
- Limited introspection (only validate() method exposed)
- Returns generic template

## Extending for Custom Libraries

You can register a custom template generator for any validation library:

```typescript
import { registerTemplateGenerator } from '@getvision/core'

// Register generator for your library
registerTemplateGenerator('my-library', (schema) => {
  // Extract fields from your schema
  const fields = extractFields(schema)
  
  return {
    template: generateJsonTemplate(fields),
    fields
  }
})
```

## Notes

- Template generation is separate from validation
- Falls back gracefully for unsupported schemas
- Uses lazy loading to avoid requiring all libraries
- Maintains backward compatibility with `generateZodTemplate`
