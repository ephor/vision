/**
 * Test showing that types work correctly!
 * TypeScript correctly prevents invalid usage
 */

import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from './generated'

function TestComponent() {
  // ✅ WORKS - correct types!
  const { data } = useQuery(
    api.users.list.queryOptions({ page: 1, limit: 10 })
  )

  // ✅ WORKS - create user with correct input
  const createUser = useMutation(
    api.users.create.mutationOptions({
      onSuccess: (newUser) => {
        // newUser is properly typed! Has id, name, email, createdAt
        console.log('Created:', newUser.id, newUser.name)
      }
    })
  )

  // ✅ WORKS - update user (only name & email, NO id in body!)
  const updateUser = useMutation(
    api.users.update.mutationOptions({
      onSuccess: (updatedUser) => {
        // updatedUser is properly typed!
        console.log('Updated:', updatedUser.name)
      }
    })
  )

  // ✅ WORKS - delete user (void input!)
  const deleteUser = useMutation(
    api.users.delete.mutationOptions({
      onSuccess: (result) => {
        // result is properly typed! { success: boolean, user: User }
        console.log('Deleted:', result.success, result.user.name)
      }
    })
  )

  return (
    <div>
      <h1>Users: {data?.total}</h1>

      {/* ✅ Create works */}
      <button onClick={() => createUser.mutate({
        name: 'John',
        email: 'john@example.com'
      })}>
        Create User
      </button>

      {data?.users.map(user => (
        <div key={user.id}>
          {/* TypeScript knows user has: id, name, email, createdAt */}
          <span>{user.name} ({user.email})</span>

          {/* ✅ Update works - id goes in URL path, name/email in body */}
          <button onClick={() => updateUser.mutate({
            id: String(user.id),  // Path param
            name: `${user.name} Updated`  // Body param
          })}>
            Update
          </button>

          {/* ✅ Delete works - id goes in URL path */}
          <button onClick={() => deleteUser.mutate({
            id: String(user.id)  // Path param
          })}>
            Delete
          </button>
        </div>
      ))}

      {/* ❌ These would be TypeScript ERRORS (correctly!): */}
      {/* createUser.mutate({ foo: 'bar' }) // ✗ unknown field */}
      {/* updateUser.mutate({ name: 'Test' }) // ✗ missing required 'id' path param */}
      {/* deleteUser.mutate() // ✗ missing required 'id' path param */}
      {/* updateUser.mutate({ id: '123', unknown: 'field' }) // ✗ unknown field */}
    </div>
  )
}
