# Vision Server + React Query Example

Type-safe React Query client for Vision Server with tRPC-like DX.

## Features

- **Type-only imports** - No code generation required
- **Full TypeScript inference** - Input, output, and callbacks are fully typed
- **Native React Query API** - Uses `useQuery`, `useMutation`, `useQueryClient`
- **Path params support** - Automatically merges path params with body/query

## Quick Start

```bash
# Install dependencies
pnpm install

# Start server (port 4000)
pnpm dev:server

# Start client (port 5173)
pnpm dev:client

# Or run both
pnpm dev
```

## Usage

### Server (server.ts)

```typescript
import { Vision } from '@getvision/server'
import { z } from 'zod'

const app = new Vision({ service: { name: 'My API' } })

const userService = app
  .service('users')
  .endpoint('GET', '/users', {
    input: z.object({ page: z.number(), limit: z.number() }),
    output: z.object({ users: z.array(userSchema), total: z.number() })
  }, async (input) => {
    return { users: [], total: 0 }
  })
  .endpoint('GET', '/users/:id', {
    input: z.object({ id: z.string() }),
    output: userSchema
  }, async (input) => {
    return findUser(input.id)
  })
  .endpoint('POST', '/users', {
    input: z.object({ name: z.string(), email: z.string().email() }),
    output: userSchema
  }, async (input) => {
    return createUser(input)
  })

// Export type for client
export type UserService = typeof userService

app.start(4000)
```

### Client (App.tsx)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createVisionClient } from '@getvision/react-query'
import type { UserService } from '../server'

// Create type-safe client
const api = createVisionClient<UserService>({
  baseUrl: 'http://localhost:4000'
})

function UserList() {
  const queryClient = useQueryClient()

  // ✅ Query - fully typed
  const { data, isLoading } = useQuery(
    api.users.list.queryOptions({ page: 1, limit: 10 })
  )
  // data is typed: { users: User[], total: number } | undefined

  // ✅ Mutation - fully typed
  const createUser = useMutation(
    api.users.create.mutationOptions({
      onSuccess: (newUser) => {
        // newUser is typed: User
        console.log('Created:', newUser.id, newUser.name)
        queryClient.invalidateQueries({ queryKey: ['users'] })
      }
    })
  )

  // ✅ Mutation with path params
  const updateUser = useMutation(
    api.users.update.mutationOptions({
      onSuccess: (updatedUser) => {
        // updatedUser is typed: User
        queryClient.setQueryData(['users', updatedUser.id], updatedUser)
      }
    })
  )

  return (
    <div>
      {data?.users.map(user => (
        <div key={user.id}>
          {user.name} ({user.email})
          <button onClick={() => updateUser.mutate({ id: user.id, name: 'New Name' })}>
            Update
          </button>
        </div>
      ))}
      <button onClick={() => createUser.mutate({ name: 'John', email: 'john@example.com' })}>
        Create
      </button>
    </div>
  )
}
```

## Path to Procedure Mapping

| Path | Procedure Name |
|------|----------------|
| `/users` | `list` |
| `/users/:id` | `byId` |
| `/users/create` | `create` |
| `/users/:id/update` | `update` |

## Type Safety

```typescript
// ✅ TypeScript catches errors at compile time
api.users.list.queryOptions({ invalid: 'field' })  // Error: Unknown field
api.users.byId.queryOptions()                       // Error: Missing 'id'
api.users.create.mutationOptions({
  onSuccess: (user) => {
    console.log(user.nonexistent)                   // Error: Property doesn't exist
  }
})
```

## Migration from tRPC

The API is designed to be nearly identical to tRPC:

```diff
- import { trpc } from './trpc-client'
+ import { api } from './vision-client'

- const { data } = useQuery(trpc.users.list.queryOptions({ limit: 10 }))
+ const { data } = useQuery(api.users.list.queryOptions({ limit: 10 }))
```
