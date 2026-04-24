import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center text-center px-4 py-16">
      <h1 className="text-5xl font-bold mb-4">404</h1>
      <p className="text-lg text-fd-muted-foreground mb-8">
        The page you're looking for doesn't exist.
      </p>
      <Link
        href="/"
        className="px-6 py-3 bg-fd-primary text-fd-primary-foreground font-semibold rounded-lg hover:opacity-90 transition-opacity"
      >
        Go Home
      </Link>
    </main>
  );
}
