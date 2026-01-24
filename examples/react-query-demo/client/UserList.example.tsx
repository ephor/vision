/**
 * Example React component using Vision React Query
 * (For demonstration - not a working React app)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type User, type CreateUserInput } from './api'

export function UserList() {
  const queryClient = useQueryClient()

  // Query - EXACTLY like tRPC! 🔥
  const { data, isLoading, error } = useQuery(
    api.users.list.queryOptions(
      { page: 1, limit: 10 },
      {
        staleTime: 5000,
        refetchOnMount: 'always',
      }
    )
  )

  // Mutation - EXACTLY like tRPC! 🔥
  const createUserMutation = useMutation(
    api.users.create.mutationOptions({
      onSuccess: (newUser) => {
        console.log('Created user:', newUser)
        // Invalidate and refetch
        queryClient.invalidateQueries({ queryKey: ['users', 'list'] })
      },
      onError: (error) => {
        console.error('Failed to create user:', error)
      },
    })
  )

  const updateUserMutation = useMutation(
    api.users.update.mutationOptions({
      onMutate: async (variables) => {
        // Optimistic update
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
        // Rollback on error
        queryClient.setQueryData(['users', 'list'], context?.previousUsers)
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ['users', 'list'] })
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
 * SSR Example (Next.js App Router)
 */
export async function UserListServer() {
  // Server Component
  const { createVisionServerClient } = await import('@getvision/react-query/server')

  const serverApi = createVisionServerClient<typeof api>({
    baseUrl: 'http://localhost:3000',
    dashboardUrl: 'http://localhost:9500',
    // Forward cookies/auth
    // headers: { cookie: cookies().toString() }
  })

  // Prefetch on server
  await serverApi.users.list.prefetch({ page: 1, limit: 10 })

  return (
    <div>
      {/* Use dehydrated state in client components */}
    </div>
  )
}
