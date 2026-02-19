TASK: Vision Server + React Query Type-Safe Client
🎯 Goal
Create a type-safe React Query client for Vision Server that provides tRPC-like DX:

Type-only imports (no code generation)
Full TypeScript inference from server to client
Native React Query API (useQuery, useMutation, useQueryClient)
Seamless migration from tRPC
🏗️ Vision Server API Structure (Current)
import { Vision } from '@getvision/server'
import { z } from 'zod'

const app = new Vision({
service: {
name: 'My API',
version: '1.0.0',
description: 'Example app',
integrations: { database: 'sqlite://./dev.db' }
},
vision: {
enabled: true,
port: 9500,
apiUrl: 'http://localhost:4000'
},
pubsub: {
devMode: true,  // In-memory event bus (no Redis)
}
})
.endpoint('GET', '/users', {
input: z.object({
page: z.number().default(1),
limit: z.number().default(10)
}),
output: z.object({
users: z.array(z.object({
id: z.string(),
name: z.string(),
email: z.string()
}))
})
}, async (ctx) => {
const { page, limit } = ctx.query
return { users: [...], total: 100 }
})
.endpoint('GET', '/users/:id', {
input: z.object({
id: z.string()
}),
output: z.object({
id: z.string(),
name: z.string(),
email: z.string(),
articles: z.array(z.object({
id: z.string(),
title: z.string()
}))
})
}, async (ctx) => {
const { id } = ctx.params
return findUser(id)
})
.endpoint('POST', '/users', {
input: z.object({
name: z.string().min(1).describe('Full name'),
email: z.string().email().describe('Email address')
}),
output: z.object({
id: z.string(),
name: z.string(),
email: z.string()
})
},
async (ctx) => {
const user = await createUser(ctx.body)
return user
})
.endpoint('PUT', '/users/:id', {
params: z.object({ id: z.string() }),
input: z.object({
name: z.string().optional(),
email: z.string().email().optional()
}),
output: userSchema
}, async (ctx) => {
return updateUser(ctx.params.id, ctx.body)
})
.endpoint('DELETE', '/users/:id', {
input: z.object({ id: z.string() }),
output: z.object({
success: z.boolean(),
user: userSchema
})
}, async (ctx) => {
return deleteUser(ctx.params.id)
})

// Export type for client
export type AppRouter = typeof app

Key points:

.endpoint(method, path, config, handler) - NOT service builder
Config can have: params, query, body, response
params - path parameters (:id in URL)
query - query string parameters (for GET)
body - request body (for POST/PUT)
response - response schema
🎯 Desired Client API (Exactly like tRPC)
// ========================================
// CLIENT
// ========================================
import { createVisionClient } from '@getvision/react-query'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AppRouter } from './server'  // Type-only import!

const api = createVisionClient<AppRouter>({
baseUrl: 'http://localhost:4000'
})

function MyComponent() {
const queryClient = useQueryClient()

// ✅ Query - exactly like tRPC
const { data, isLoading } = useQuery(
api.users.list.queryOptions({
page: 1,
limit: 10
})
)
// data is typed: { users: User[], total: number } | undefined

// ✅ Mutation - exactly like tRPC
const createUser = useMutation(
api.users.create.mutationOptions({
onSuccess: async (data) => {
// data is typed: User
console.log('Created:', data.id, data.name)

        // Invalidate queries
        await queryClient.invalidateQueries({ queryKey: ['users'] })
      }
    })
)

// ✅ Mutation with path params
const updateUser = useMutation(
api.users.update.mutationOptions({
onSuccess: (updatedUser) => {
// updatedUser is typed: User
queryClient.setQueryData(
['users', updatedUser.id],
updatedUser
)
}
})
)

return (
<div>
{/* List users */}
{data?.users.map(user => (
<div key={user.id}>
<span>{user.name} ({user.email})</span>

          <button onClick={() => {
            // ✅ Input is typed: { id: string, name?: string, email?: string }
            updateUser.mutate({
              id: String(user.id),
              name: 'New Name'
            })
          }}>
            Update
          </button>
        </div>
      ))}

      {/* Create user */}
      <button onClick={() => {
        // ✅ Input is typed: { name: string, email: string }
        createUser.mutate({
          name: 'John',
          email: 'john@example.com'
        })
      }}>
        Create
      </button>
    </div>
)
}

Requirements:

✅ .queryOptions() - returns React Query options
✅ .mutationOptions() - returns React Query options
✅ Callbacks properly typed (NOT any or unknown)
✅ Input/output types inferred from Zod schemas
✅ Path params merged with body params in input
⚠️ .queryFilter() - nice to have, but can skip
📊 Current State (Branch: claude/react-query-client-rpu4c)
What Was Attempted:
Code generation approach - generates generated.ts with runtime Zod schemas
Path params support - extracts :id from paths and adds to input schema
tRPC-style _types field - stores inferred types in generated routes
Runtime client - proxy-based with buildUrl() and getBodyParams()
Why It Failed:
Code generation is wrong approach - tRPC/Hono RPC use type-only imports
Type inference broken - callbacks have unknown instead of proper types
No Vision Server integration - only tried Hono adapter
Examples are messy - multiple conflicting files (api.ts, shared/, generated.ts)
Files Modified (for reference):
packages/core/src/codegen/client-generator.ts - codegen logic
packages/react-query/src/client.ts - runtime client
packages/react-query/src/inference.ts - type inference (broken)
examples/react-query-demo/ - messy examples
🎯 What Needs to Be Done (New Branch)
Phase 1: Type Extraction from Vision Server
Goal: Extract endpoint types from Vision Server instance

// packages/react-query/src/vision-server-types.ts (NEW FILE)

import type { Vision } from '@getvision/server'

// Extract endpoints from Vision instance
type ExtractEndpoints<T> = T extends Vision<infer Endpoints>
? Endpoints
: never

// Convert endpoint config to procedure type
type EndpointToProcedure<E> = E extends {
method: infer M
params?: infer P
query?: infer Q
body?: infer B
response: infer R
}
? {
method: M
input: MergeInputs<P, Q, B>  // Merge params + query + body
output: InferSchema<R>
}
: never

// Merge params, query, body into single input type
type MergeInputs<P, Q, B> =
// If has params, query, body - merge all three
P extends object
? Q extends object
? B extends object
? InferSchema<P> & InferSchema<Q> & InferSchema<B>
: InferSchema<P> & InferSchema<Q>
: B extends object
? InferSchema<P> & InferSchema<B>
: InferSchema<P>
// If no params, check query + body
: Q extends object
? B extends object
? InferSchema<Q> & InferSchema<B>
: InferSchema<Q>
: B extends object
? InferSchema<B>
: void

// Infer type from Zod schema
type InferSchema<S> = S extends { _output: infer O }
? O
: S extends { parse: (x: any) => infer O }
? O
: unknown

// Group endpoints by service (from path)
type GroupByService<Endpoints> = {
// Extract service name from path: /users/list → users
// Create nested structure: { users: { list: Procedure } }
}

export type InferVisionRouter<T extends Vision> = GroupByService<ExtractEndpoints<T>>

Challenges:

Vision Server stores endpoints in _def or similar structure (need to check actual implementation)
Need to parse path /users/:id to extract service name (users) and procedure name (id or byId)
Need to detect HTTP method (GET = query, POST/PUT/DELETE = mutation)
Phase 2: Runtime Client (Reuse Existing)
Good news: Current runtime client in packages/react-query/src/client.ts mostly works!

What to keep:

buildUrl(path, input) - substitutes path params into URL ✅
getBodyParams(path, input) - removes path params from body ✅
Proxy-based navigation (api.users.list) ✅
.queryOptions() and .mutationOptions() methods ✅
What to fix:

Type inference - ensure callbacks get proper types (not unknown)
Integration with Vision Server type extraction
Phase 3: Clean Example
Goal: Single clean example showing Vision Server + React Query

examples/vision-server-react-query/
├── server.ts                # Vision Server app
├── client.tsx              # React app using createVisionClient
├── package.json
└── tsconfig.json

Delete:

❌ examples/react-query-demo/client/api.ts
❌ examples/react-query-demo/client/generated.ts
❌ examples/react-query-demo/client/test-correct-usage.tsx
❌ examples/react-query-demo/client/UserList*.tsx
❌ examples/react-query-demo/shared/
Keep clean structure:

server.ts - Vision Server with endpoints
client.tsx - React component using API
Phase 4: Testing
Verify type inference in callbacks
Test path params (:id in URL)
Test query params (GET requests)
Test body params (POST/PUT requests)
Ensure TypeScript catches errors
🔧 Technical Challenges
Challenge 1: Finding Vision Server Type Structure
Need to investigate how Vision Server stores endpoint metadata:

Check @getvision/server source code
Find where .endpoint() method stores config
Understand _def structure
Challenge 2: Path to Service/Procedure Mapping
Routes like /users/:id need to map to api.users.byId:

/users         → api.users.list  (or api.users.index?)
/users/:id     → api.users.byId  (or api.users[':id']?)
/users/create  → api.users.create

Question: How to name procedures?

Use last path segment? /users/list → list
Use :id for dynamic params? /users/:id → byId
Keep :id as-is? /users/:id → [':id'] (Hono style)
Challenge 3: GET vs POST Method Detection
Need to determine if endpoint is query or mutation:

GET → query (use useQuery)
POST, PUT, DELETE → mutation (use useMutation)
Should be straightforward from method string.

Challenge 4: Merging Path/Query/Body Params
Example: PUT /users/:id with body

Input type should be:
{
id: string,        // from params
name?: string,     // from body
email?: string     // from body
}

Runtime client must:

Extract id from input
Substitute into URL: /users/:id → /users/123
Send remaining fields in body: { name: 'New Name' }
Current implementation (buildUrl + getBodyParams) already does this! ✅

📦 Package Structure
packages/react-query/
├── src/
│   ├── client.ts              # Runtime client (keep existing)
│   ├── vision-server-types.ts # Type extraction (NEW)
│   ├── inference.ts           # Generic types (update)
│   └── index.ts               # Exports
└── package.json

🎯 Success Criteria
Type Safety:
const api = createVisionClient<AppRouter>({ baseUrl: '...' })

// ✅ Should work:
api.users.list.queryOptions({ page: 1, limit: 10 })
api.users.byId.queryOptions({ id: '123' })
api.users.create.mutationOptions()

// ❌ Should error:
api.users.list.queryOptions({ invalid: 'field' })  // Unknown field
api.users.byId.queryOptions()  // Missing required 'id'

Callback Types:
useMutation(
api.users.create.mutationOptions({
onSuccess: (user) => {
// user should be typed as User, not unknown!
console.log(user.id, user.name)  // ✅ No TypeScript error
}
})
)

Runtime Behavior:
// Input: { id: '123', name: 'Updated' }
// Route: PUT /users/:id
//
// Should produce:
// - URL: /users/123
// - Body: { name: 'Updated' }

🚀 Action Plan
Create new branch: claude/vision-server-react-query
Investigate Vision Server: Check how endpoints are stored
Create type extraction: vision-server-types.ts
Update inference: Connect to existing runtime client
Clean examples: One simple Vision Server + React example
Test thoroughly: Verify all type inference works
Document: Clear README showing migration from tRPC
📝 Notes
Focus ONLY on Vision Server - no Hono/Express/Fastify
Type-only approach - no code generation
Exact tRPC API - for easy migration
Native React Query - just useQuery/useMutation/useQueryClient
Path params support - merge with body/query params
queryFilter is optional - can skip if complex
🔍 Research Needed
Before starting, need to check:

Where does Vision Server store endpoint metadata?
What is the exact TypeScript type of Vision instance?
How are endpoints stored internally (array? map? _def?)
Can we extract types from typeof app?
Check these files:

packages/server/src/index.ts - Vision Server implementation
packages/server/src/server.ts - Main Vision class
Look for endpoint() method and how it stores config