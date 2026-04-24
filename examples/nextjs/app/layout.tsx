import type { ReactNode } from 'react'
import { Providers } from './providers'

export const metadata = {
  title: 'Vision + Next.js',
  description: 'Vision server mounted inside a Next.js catch-all route.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          margin: 0,
          padding: 0,
          background: '#0b0d10',
          color: '#e8ebef',
        }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
