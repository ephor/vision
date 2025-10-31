import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col justify-center text-center px-4">
      <div className="mb-8">
        <h1 className="mb-4 text-5xl font-bold">Vision</h1>
        <p className="text-xl text-fd-muted-foreground mb-8">
          Universal observability for modern apps
        </p>
        <p className="text-lg text-fd-muted-foreground max-w-2xl mx-auto mb-8">
          One tool for REST, tRPC, GraphQL, MCP. Beautiful UI, &lt; 5min setup, open source.
        </p>
      </div>
      
      <div className="flex gap-4 justify-center">
        <Link
          href="/docs"
          className="px-6 py-3 bg-fd-primary text-fd-primary-foreground font-semibold rounded-lg hover:opacity-90 transition-opacity"
        >
          Get Started
        </Link>
        <Link
          href="/docs/quickstart"
          className="px-6 py-3 border border-fd-border font-semibold rounded-lg hover:bg-fd-accent transition-colors"
        >
          Quickstart
        </Link>
      </div>
      
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto text-left">
        <div>
          <h3 className="font-bold mb-2">🚀 Fast Setup</h3>
          <p className="text-sm text-fd-muted-foreground">
            One middleware, zero configuration. Up and running in under 5 minutes.
          </p>
        </div>
        <div>
          <h3 className="font-bold mb-2">🎨 Beautiful UI</h3>
          <p className="text-sm text-fd-muted-foreground">
            Modern dashboard with real-time tracing, API explorer, and dark mode.
          </p>
        </div>
        <div>
          <h3 className="font-bold mb-2">🌐 Universal Protocols</h3>
          <p className="text-sm text-fd-muted-foreground">
            REST, tRPC, GraphQL, MCP - all in one dashboard. No more tool switching.
          </p>
        </div>
      </div>
    </main>
  );
}
