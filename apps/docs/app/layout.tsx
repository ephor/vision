import '@/app/global.css';
import type { Metadata } from 'next';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://getvision.dev'
  ),
  title: {
    default: 'Vision — Universal Observability for API Development',
    template: '%s | Vision',
  },
  description:
    'Open-source observability dashboard for REST, GraphQL, tRPC, and MCP. Real-time tracing, API explorer, and validation — under 5 minutes to set up.',
  keywords: [
    'API observability',
    'REST tracing',
    'GraphQL monitoring',
    'tRPC dashboard',
    'MCP observability',
    'Express middleware',
    'Hono middleware',
    'Fastify plugin',
    'developer tools',
    'open source',
  ],
  openGraph: {
    type: 'website',
    siteName: 'Vision',
    title: 'Vision — Universal Observability for API Development',
    description:
      'Open-source observability dashboard for REST, GraphQL, tRPC, and MCP. Real-time tracing, API explorer, and validation — under 5 minutes to set up.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vision — Universal Observability for API Development',
    description:
      'Open-source observability dashboard for REST, GraphQL, tRPC, and MCP.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
