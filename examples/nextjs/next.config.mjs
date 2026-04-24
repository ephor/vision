/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vision depends on Node built-ins (async_hooks, net, fs, child_process) and
  // packages that ship their own runtime code (BullMQ, ioredis). Listing them
  // here keeps Next's bundler from re-packaging them for Route Handlers.
  // In Next.js 16, `serverExternalPackages` is top-level (was `experimental.serverComponentsExternalPackages` in 14/15).
  serverExternalPackages: ['@getvision/server', '@getvision/core', 'bullmq', 'ioredis'],
}

export default nextConfig
