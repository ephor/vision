/**
 * Example React component using AUTO-GENERATED Vision client
 * Client is auto-generated from server routes - NO MANUAL WORK! 🔥
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
// ✨ Import from AUTO-GENERATED file!
import { api, type User } from './generated'

export function UserList() {
  const queryClient = useQueryClient()

  // Query - EXACTLY like tRPC, but client is AUTO-GENERATED! 🔥
  const { data, isLoading, error } = useQuery(
    api.users.list.queryOptions(
      { page: 1, limit: 10 },
      {
        staleTime: 5000,
        refetchOnMount: 'always',
      }
    )
  )
  // data is FULLY TYPED from auto-generated schemas! ✨

  // Mutation - AUTO-GENERATED from server routes!
  const createUserMutation = useMutation(
    api.users.create.mutationOptions({
      onSuccess: (newUser) => {
        console.log('Created user:', newUser)
        // newUser is FULLY TYPED! ✨
        queryClient.invalidateQueries({ queryKey: ['users', 'list'] })
      },
    })
  )

  const updateUserMutation = useMutation(
    api.users.update.mutationOptions({
      onMutate: async (variables) => {
        await queryClient.cancelQueries({ queryKey: ['users', 'list'] })

        const previousUsers = queryClient.getQueryData(['users', 'list'])

        queryClient.setQueryData(['users', 'list'], (old: any) => ({
          ...old,
          users: old.users.map((u: User) =>
            u.id === variables.id ? { ...u, ...variables } : u
          ),
        }))

        return { previousUsers }
      },
      onError: (err, variables, context) => {
        queryClient.setQueryData(['users', 'list'], context?.previousUsers)
      },
    })
  )

  const deleteUserMutation = useMutation(
    api.users.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['users', 'list'] })
      },
    })
  )

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div>
      <h1>Users ({data?.total || 0})</h1>

      <div>
        <button
          onClick={() => {
            createUserMutation.mutate({
              name: 'New User',
              email: `user${Date.now()}@example.com`,
            })
          }}
          disabled={createUserMutation.isPending}
        >
          {createUserMutation.isPending ? 'Creating...' : 'Create User'}
        </button>
      </div>

      <ul>
        {data?.users.map((user) => (
          <li key={user.id}>
            <strong>{user.name}</strong> ({user.email})
            <button
              onClick={() => {
                // TypeScript knows exactly what fields are allowed!
                updateUserMutation.mutate({
                  id: user.id,
                  name: `${user.name} (Updated)`,
                })
              }}
              disabled={updateUserMutation.isPending}
            >
              Update
            </button>
            <button
              onClick={() => {
                deleteUserMutation.mutate({ id: user.id })
              }}
              disabled={deleteUserMutation.isPending}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>

      <div>
        <p>Page: {data?.page}</p>
        <p>Limit: {data?.limit}</p>
      </div>
    </div>
  )
}

/**
 * How it works:
 *
 * 1. Server starts with `visionAdapter({ client: { output: './client/generated.ts' } })`
 * 2. Vision auto-discovers all routes
 * 3. Vision generates `generated.ts` with:
 *    - Zod schemas from route metadata
 *    - Type-safe routes object
 *    - createVisionClient call
 *    - Type exports
 * 4. Client imports from `generated.ts`
 * 5. FULL type safety - compile-time + runtime! ✨
 *
 * NO MANUAL WORK REQUIRED! 🔥
 */
