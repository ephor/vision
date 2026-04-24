'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 48 }}>
        <h1 style={{ fontSize: 48, margin: 0 }}>500</h1>
        <p style={{ color: '#64748b', marginTop: 8 }}>Something went wrong.</p>
        {error?.digest && (
          <p style={{ color: '#94a3b8', fontSize: 13, fontFamily: 'monospace' }}>
            digest: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{
            marginTop: 24,
            padding: '8px 16px',
            borderRadius: 6,
            border: '1px solid #334155',
            background: '#0f172a',
            color: '#e2e8f0',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
