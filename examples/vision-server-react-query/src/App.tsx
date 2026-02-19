/**
 * React Query Client Example
 * Demonstrates type-safe API calls with Vision Server
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createVisionClient } from '@getvision/react-query'
import type { UserService } from '../server'

const api = createVisionClient<UserService>({
  baseUrl: 'http://localhost:4000',
})

function UserList() {
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery(
    api.users.list.queryOptions({ page: 1, limit: 10 })
  )

  const createUser = useMutation(
    api.users.create.mutationOptions({
      onSuccess: (newUser) => {
        console.log('Created user:', newUser.id, newUser.name)
        queryClient.invalidateQueries({ queryKey: ['users'] })
      },
    })
  )

  const updateUser = useMutation(
    api.users.update.mutationOptions({
      onSuccess: (updatedUser) => {
        console.log('Updated user:', updatedUser.name)
        queryClient.invalidateQueries({ queryKey: ['users'] })
      },
    })
  )

  const deleteUser = useMutation(
    api.users.delete.mutationOptions({
      onSuccess: (result) => {
        console.log('Deleted user:', result.deletedUser.name)
        queryClient.invalidateQueries({ queryKey: ['users'] })
      },
    })
  )

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
      <h1>Vision Server + React Query Demo</h1>
      
      <section>
        <h2>Users ({data?.total ?? 0})</h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {data?.users.map((user) => (
            <li
              key={user.id}
              style={{
                padding: '10px',
                marginBottom: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <strong>{user.name}</strong>
                <br />
                <small>{user.email}</small>
              </div>
              <div>
                <button
                  onClick={() =>
                    updateUser.mutate({
                      id: user.id,
                      name: `${user.name} (updated)`,
                    })
                  }
                  disabled={updateUser.isPending}
                  style={{ marginRight: '8px' }}
                >
                  Update
                </button>
                <button
                  onClick={() => deleteUser.mutate({ id: user.id })}
                  disabled={deleteUser.isPending}
                  style={{ color: 'red' }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Create User</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const formData = new FormData(e.currentTarget)
            createUser.mutate({
              name: formData.get('name') as string,
              email: formData.get('email') as string,
            })
            e.currentTarget.reset()
          }}
        >
          <input
            name="name"
            placeholder="Name"
            required
            style={{ marginRight: '8px', padding: '8px' }}
          />
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            style={{ marginRight: '8px', padding: '8px' }}
          />
          <button type="submit" disabled={createUser.isPending}>
            {createUser.isPending ? 'Creating...' : 'Create'}
          </button>
        </form>
      </section>

      <section style={{ marginTop: '20px', color: '#666' }}>
        <h3>Type Safety Demo</h3>
        <p>
          All API calls are fully typed. Try hovering over <code>data</code>,{' '}
          <code>newUser</code>, or <code>updatedUser</code> in your IDE to see
          the inferred types.
        </p>
        <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
{`// Input is typed: { page: number, limit: number }
api.users.list.queryOptions({ page: 1, limit: 10 })

// Output is typed: { users: User[], total: number, ... }
const { data } = useQuery(...)

// Mutation input is typed: { name: string, email: string }
createUser.mutate({ name: 'John', email: 'john@example.com' })

// onSuccess callback receives typed User
onSuccess: (newUser) => {
  console.log(newUser.id, newUser.name) // ✅ Fully typed!
}`}
        </pre>
      </section>
    </div>
  )
}

export default function App() {
  return <UserList />
}
