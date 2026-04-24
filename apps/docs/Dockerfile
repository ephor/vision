# syntax=docker/dockerfile:1

# ============================================
# Base stage - Bun with essential packages
# ============================================
FROM oven/bun:1-alpine AS base
RUN apk add --no-cache libc6-compat
RUN apk update

# ============================================
# Builder stage - prune monorepo
# ============================================
FROM base AS builder
WORKDIR /app
RUN bun add -g turbo
COPY . .
RUN turbo prune app --docker

# ============================================
# Installer stage - install dependencies and build
# ============================================
FROM base AS installer
WORKDIR /app

# Copy pruned lockfile and package files
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/bun.lock ./bun.lock

# Install dependencies with bun
RUN bun install

# Copy source code
COPY --from=builder /app/out/full/ .
COPY --from=builder /app/turbo.json ./turbo.json

# Build Next.js app
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run turbo build --filter=docs...

# ============================================
# Runner stage - production
# ============================================
FROM oven/bun:1-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Don't run as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

# Copy standalone build
COPY --from=installer --chown=nextjs:nodejs /app/apps/docs/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/docs/.next/static ./apps/docs/.next/static
COPY --from=installer --chown=nextjs:nodejs /app/apps/docs/public ./apps/docs/public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Next.js standalone uses node server.js
CMD ["bun", "apps/docs/server.js"]
