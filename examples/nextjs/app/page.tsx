'use client'

import { useMemo } from 'react'
import { treaty } from '@elysiajs/eden'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { AppType } from '@/vision'

const panel: React.CSSProperties = {
  background: '#14181d',
  border: '1px solid #2a2f36',
  borderRadius: 10,
  padding: 16,
  marginBottom: 14,
}
const title: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
}
const sub: React.CSSProperties = {
  margin: '2px 0 12px',
  fontSize: 12,
  color: '#94a3b8',
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
}
const btn: React.CSSProperties = {
  background: '#1e293b',
  color: '#e2e8f0',
  border: '1px solid #334155',
  borderRadius: 6,
  padding: '6px 12px',
  fontSize: 12,
  fontFamily: 'inherit',
  cursor: 'pointer',
}
const out: React.CSSProperties = {
  marginTop: 10,
  background: '#0b0d10',
  border: '1px solid #1f242b',
  borderRadius: 6,
  padding: 10,
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSize: 12,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  color: '#cbd5e1',
  maxHeight: 220,
  overflow: 'auto',
}
const badge = (bg: string, fg: string): React.CSSProperties => ({
  background: bg,
  color: fg,
  padding: '1px 6px',
  borderRadius: 4,
  fontSize: 11,
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
})

function Result({
  status,
  error,
  data,
  idle,
}: {
  status: number | null | undefined
  error: unknown
  data: unknown
  idle: boolean
}) {
  if (idle) return null
  const body = error ?? data
  if (body === undefined) return <div style={{ ...out, color: '#94a3b8' }}>loading…</div>
  const color = error ? '#ef4444' : '#22c55e'
  return (
    <div style={out}>
      <div style={{ color, marginBottom: 6 }}>{status ?? 'error'}</div>
      {typeof body === 'string' ? body : JSON.stringify(body, null, 2)}
    </div>
  )
}

export default function Page() {
  const api = useMemo(
    () => treaty<AppType>('http://localhost:3100/api'),
    []
  )

  // GET /users — manual-trigger query (fetched on button click).
  const listUsers = useQuery({
    queryKey: ['users'],
    queryFn: () => api.users.get(),
    enabled: false,
  })

  // GET /users/:id
  const getUser = useQuery({
    queryKey: ['users', '1'],
    queryFn: () => api.users({ id: '1' }).get(),
    enabled: false,
  })

  // GET /products/:id/reviews
  const reviews = useQuery({
    queryKey: ['products', 'laptop', 'reviews'],
    queryFn: () => api.products({ id: 'laptop' }).reviews.get(),
    enabled: false,
  })

  // GET /admin/stats
  const adminStats = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.admin.stats.get(),
    enabled: false,
  })

  // POST /users — rate-limited 3/min
  const createUser = useMutation({
    mutationFn: () =>
      api.users.post({
        name: `User ${Math.floor(Math.random() * 1000)}`,
        email: `u${Math.floor(Math.random() * 1000)}@example.com`,
        userId: '',
        items: [],
      }),
  })

  // POST /orders — pub/sub
  const placeOrder = useMutation({
    mutationFn: () =>
      api.orders.post({
        name: 'Name',
        email: 'email@example.com',
        userId: '1',
        items: [{ productId: 'laptop', qty: 2 }],
      }),
  })

  return (
    <main style={{ maxWidth: 820, margin: '40px auto', padding: '0 24px' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Vision × Next.js 16</h1>
        <p style={{ color: '#94a3b8', marginTop: 6, fontSize: 13 }}>
          Interactive demo of the Eden <code>treaty&lt;AppType&gt;</code> client
          calling the Vision server mounted in{' '}
          <code>app/api/[[...slug]]/route.ts</code>. Response types are inferred
          from the server schema — hover <code>.data</code> in your editor.
        </p>
        <p style={{ color: '#64748b', marginTop: 6, fontSize: 12 }}>
          Dashboard:{' '}
          <a
            href="http://localhost:9500"
            target="_blank"
            rel="noreferrer"
            style={{ color: '#7dd3fc' }}
          >
            localhost:9500
          </a>{' '}
          (boots lazily on first API call)
        </p>
      </header>

      <section style={panel}>
        <h3 style={title}>
          List users <span style={badge('#0f2a20', '#4ade80')}>GET /users</span>
        </h3>
        <p style={sub}>api.users.get()</p>
        <button style={btn} onClick={() => listUsers.refetch()}>
          Run
        </button>
        <Result
          idle={listUsers.fetchStatus === 'idle' && !listUsers.data && !listUsers.error}
          status={listUsers.data?.status ?? null}
          data={listUsers.data?.data}
          error={listUsers.data?.error ?? listUsers.error}
        />
      </section>

      <section style={panel}>
        <h3 style={title}>
          Get user by id{' '}
          <span style={badge('#0f2a20', '#4ade80')}>GET /users/:id</span>
        </h3>
        <p style={sub}>api.users({'{ id: "1" }'}).get()</p>
        <button style={btn} onClick={() => getUser.refetch()}>
          Run
        </button>
        <Result
          idle={getUser.fetchStatus === 'idle' && !getUser.data && !getUser.error}
          status={getUser.data?.status ?? null}
          data={getUser.data?.data}
          error={getUser.data?.error ?? getUser.error}
        />
      </section>

      <section style={panel}>
        <h3 style={title}>
          Create user — rate-limited{' '}
          <span style={badge('#2a1f0f', '#fbbf24')}>POST /users · 3/min</span>
        </h3>
        <p style={sub}>
          emits 'user/created' → check server terminal for "📧 Welcome email →"
        </p>
        <button style={btn} onClick={() => createUser.mutate()}>
          Run (4th+ call within 1 minute → 429)
        </button>
        <Result
          idle={createUser.isIdle}
          status={createUser.data?.status ?? null}
          data={createUser.data?.data}
          error={createUser.data?.error ?? createUser.error}
        />
      </section>

      <section style={panel}>
        <h3 style={title}>
          Nested sub-resource{' '}
          <span style={badge('#0f2a20', '#4ade80')}>
            GET /products/:id/reviews
          </span>
        </h3>
        <p style={sub}>api.products({'{ id: "laptop" }'}).reviews.get()</p>
        <button style={btn} onClick={() => reviews.refetch()}>
          Run
        </button>
        <Result
          idle={reviews.fetchStatus === 'idle' && !reviews.data && !reviews.error}
          status={reviews.data?.status ?? null}
          data={reviews.data?.data}
          error={reviews.data?.error ?? reviews.error}
        />
      </section>

      <section style={panel}>
        <h3 style={title}>
          Place order — pub/sub{' '}
          <span style={badge('#1a1228', '#c084fc')}>POST /orders</span>
        </h3>
        <p style={sub}>
          emits 'order/placed' → check server terminal for "📦 processing"
        </p>
        <button style={btn} onClick={() => placeOrder.mutate()}>
          Run
        </button>
        <Result
          idle={placeOrder.isIdle}
          status={placeOrder.data?.status ?? null}
          data={placeOrder.data?.data}
          error={placeOrder.data?.error ?? placeOrder.error}
        />
      </section>

      <section style={panel}>
        <h3 style={title}>
          Admin stats — module-level rate-limit{' '}
          <span style={badge('#2a1f0f', '#fbbf24')}>
            GET /admin/stats · 10/30s
          </span>
        </h3>
        <p style={sub}>api.admin.stats.get()</p>
        <button style={btn} onClick={() => adminStats.refetch()}>
          Run
        </button>
        <Result
          idle={adminStats.fetchStatus === 'idle' && !adminStats.data && !adminStats.error}
          status={adminStats.data?.status ?? null}
          data={adminStats.data?.data}
          error={adminStats.data?.error ?? adminStats.error}
        />
      </section>
    </main>
  )
}