---
"@getvision/server": minor
"@getvision/adapter-express": minor
"@getvision/adapter-fastify": minor
"@getvision/adapter-hono": minor
---

Migrate all adapters to use UniversalValidator supporting Zod, Valibot, and Standard Schema v1. The new validation system provides:

- Unified `validator()` function that works with any validation library
- Automatic error response formatting with proper issue paths
- Schema introspection for template generation
- Backward compatibility with existing zValidator (deprecated)

**Breaking changes:**
- `zValidator` is now deprecated in favor of universal `validator()`
- Error response format has been standardized across all adapters
- Some internal types have changed to support multiple validation libraries

Migration guide:
```ts
// Before
import { zValidator } from '@getvision/adapter-hono'
app.post('/users', zValidator('json', userSchema))

// After (works with Zod, Valibot, or Standard Schema)
import { validator } from '@getvision/adapter-hono'
app.post('/users', validator('json', userSchema))
```
