# Universal Validation System

This module provides a universal validation system that supports any validation library implementing the [Standard Schema v1](https://standardschema.dev/) specification.

## Features

- **Vendor-agnostic**: Use Zod, Valibot, Arktype, or any Standard Schema-compliant library
- **Type-safe**: Full TypeScript support with inferred types
- **Consistent errors**: Standardized error responses across all libraries
- **Easy migration**: Simple adapters for existing validation libraries

## Quick Start

```typescript
import { UniversalValidator } from '@getvision/core/validation'
import { z } from 'zod' // or any other supported library

const schema = z.object({
  name: z.string(),
  email: z.string().email()
})

// Validate data
try {
  const result = UniversalValidator.parse(schema, data)
  // result is typed
} catch (error) {
  if (error instanceof ValidationError) {
    console.log(error.issues) // Detailed validation errors
  }
}
```

## Supported Libraries

### Zod
```typescript
import { z } from 'zod'
const schema = z.object({ name: z.string() })
```

### Valibot
```typescript
import * as v from 'valibot'
const schema = v.object({ name: v.string() })
```

### Arktype
```typescript
import { type } from 'arktype'
const schema = type({ name: "string" })
```

### Custom Standard Schema
```typescript
const schema: StandardSchemaV1 = {
  "~standard": {
    version: 1,
    vendor: "custom",
    validate: (value) => {
      // Your validation logic
    }
  }
}
```

## Error Handling

Validation errors follow a consistent format:

```typescript
{
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    details: [
      {
        field: 'email',
        message: 'Invalid email format',
        path: ['email']
      }
    ]
  },
  timestamp: '2024-01-09T12:00:00.000Z',
  requestId: 'req_123'
}
```

## API Reference

### UniversalValidator

- `toStandardSchema(schema)` - Convert any schema to Standard Schema
- `validate(schema, data)` - Validate data and get result
- `parse(schema, data)` - Validate data or throw error

### ValidationError

Custom error class for validation failures with detailed issues.

### createValidationErrorResponse(issues, requestId?)

Create a standardized error response for validation failures.


