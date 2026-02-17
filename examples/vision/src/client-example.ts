/**
 * client-example.ts
 *
 * Real-world demonstration of @getvision/client used against the actual
 * server types defined in src/index.ts.
 *
 * Run: npx tsc --noEmit   (must pass with zero errors)
 *
 * This file is intentionally NOT a test runner — it is a compile-only type
 * exercise. Every `const _x: ExpectedType = value` line is a type assertion:
 * if the type is wrong TypeScript will show a red squiggle here and in your IDE.
 */

import { createVisionClient, type VisionQueryOptions, type VisionMutationOptions } from '@getvision/client'
import type { AppRouter } from './index'

// ── 1. Create client with dynamic auth headers ─────────────────────────────
//
// `headers` as a function is called fresh on EVERY request,
// so JWT tokens are never stale.

let _mockToken = 'initial-token'

const client = createVisionClient<AppRouter>({
  baseUrl: 'http://localhost:4000',

  // Static headers — good for API keys that never change:
  // headers: { 'X-Api-Key': 'secret' },

  // Dynamic headers — good for JWT tokens from a store / cookie / refresh:
  headers: () => ({
    Authorization: `Bearer ${_mockToken}`,
    'X-Request-Source': 'client-example',
  }),

  // Async dynamic headers — good for refresh-token flows:
  // headers: async () => {
  //   const token = await refreshIfExpired()
  //   return { Authorization: `Bearer ${token}` }
  // },
})

// ── 2. GET /users — no path params, empty schema input ────────────────────
//
// Schema: z.object({})  → input type: {}
// Path:   /users        → no path params extracted
// Client input: {}

const listUsersQuery = client.users['GET /users'].queryOptions({})

// queryKey must be a readonly tuple
const _qk1: readonly unknown[] = listUsersQuery.queryKey

// queryFn return type must match the output schema
type ListUsersOutput = Awaited<ReturnType<typeof listUsersQuery.queryFn>>
const _listUsersResult: ListUsersOutput = {
  users: [{ id: '1', name: 'Alice', email: 'alice@example.com' }],
}

// GET endpoints must NOT have mutationOptions (would be a TS error)
// @ts-expect-error — queryOptions is a GET endpoint, mutationOptions doesn't exist
client.users['GET /users'].mutationOptions

// ── 3. GET /users/:id — path param :id required, query param isActive ─────
//
// Schema: z.object({ isActive: z.string() })
// Path:   /users/:id
//
// Client MUST supply both:
//   - id       → substituted into /users/:id   (from route key, NOT from schema)
//   - isActive → appended as ?isActive=...     (from schema)

const getUserQuery = client.users['GET /users/:id'].queryOptions({
  id: '123',       // ← path param — required by client even though NOT in schema
  isActive: 'true', // ← query param — from schema
})

type GetUserOutput = Awaited<ReturnType<typeof getUserQuery.queryFn>>
const _getUserResult: GetUserOutput = {
  id: '123',
  name: 'Alice',
  email: 'alice@example.com',
  articles: [{ id: 'a1', title: 'First' }],
}

// Missing path param must be a TS error:
// @ts-expect-error — `id` is required (extracted from route key `:id`)
client.users['GET /users/:id'].queryOptions({ isActive: 'true' })

// Missing schema field must also be a TS error:
// @ts-expect-error — `isActive` is required by the schema
client.users['GET /users/:id'].queryOptions({ id: '123' })

// ── 4. POST /users — mutation, body only (no path params) ─────────────────
//
// Schema input: { name: string; email: string }
// Path: /users  → no path params

const createUserMutation = client.users['POST /users'].mutationOptions()

type CreateUserInput  = Parameters<typeof createUserMutation.mutationFn>[0]
type CreateUserOutput = Awaited<ReturnType<typeof createUserMutation.mutationFn>>

const _createUserInput:  CreateUserInput  = { name: 'Bob', email: 'bob@example.com' }
const _createUserOutput: CreateUserOutput = { id: 'x1', name: 'Bob', email: 'bob@example.com' }

// POST endpoints must NOT have queryOptions:
// @ts-expect-error — mutationOptions is a POST endpoint, queryOptions doesn't exist
client.users['POST /users'].queryOptions

// ── 5. POST /orders — mutation with nested body ───────────────────────────

const createOrderMutation = client.orders['POST /orders'].mutationOptions()

type CreateOrderInput  = Parameters<typeof createOrderMutation.mutationFn>[0]
type CreateOrderOutput = Awaited<ReturnType<typeof createOrderMutation.mutationFn>>

const _orderInput: CreateOrderInput = {
  userId: 'u1',
  items: [{ productId: 'p1', quantity: 2 }],
  total: 59.98,
}
const _orderOutput: CreateOrderOutput = {
  orderId: 'o1',
  status: 'pending',
  total: 59.98,
}

// ── 6. Direct `.call()` — imperative fetch without query cache ─────────────

async function imperativeCalls() {
  // GET with path + query param
  const user = await client.users['GET /users/:id'].call({ id: '42', isActive: 'false' })
  // user is typed as GetUserOutput
  const _check: GetUserOutput = user

  // POST body
  const newUser = await client.users['POST /users'].call({ name: 'Eve', email: 'eve@example.com' })
  const _check2: CreateUserOutput = newUser
}

// Silence unused-variable warning; the function is never called (compile-only file).
void imperativeCalls

// ── 7. Compatibility with TanStack Query option shapes ─────────────────────
//
// These assignments confirm that the returned objects are structurally
// assignable to TanStack Query v5 option interfaces.

const _tanstackQuery: VisionQueryOptions<GetUserOutput> =
  client.users['GET /users/:id'].queryOptions({ id: '1', isActive: 'true' })

const _tanstackMutation: VisionMutationOptions<CreateUserInput, CreateUserOutput> =
  client.users['POST /users'].mutationOptions()

// ── 8. Dynamic token rotation ──────────────────────────────────────────────
//
// Because headers is a function, updating `_mockToken` affects the next
// request automatically — no need to recreate the client.

_mockToken = 'rotated-token'
// The next client.users['GET /users'].call({}) will use 'rotated-token'.

// ── Simulated React component (comment block) ─────────────────────────────
//
// import { useQuery, useMutation } from '@tanstack/react-query'
//
// function UserProfile({ id }: { id: string }) {
//   const { data } = useQuery(
//     client.users['GET /users/:id'].queryOptions({ id, isActive: 'true' })
//   )
//   // data: GetUserOutput | undefined  — fully typed, IDE autocomplete works
//
//   const mutation = useMutation(client.users['POST /users'].mutationOptions())
//
//   return (
//     <button onClick={() => mutation.mutate({ name: 'Alice', email: 'a@b.com' })}>
//       Create user
//     </button>
//   )
// }
