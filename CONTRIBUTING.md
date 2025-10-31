# Contributing to Vision

Thanks for your interest in contributing to Vision! 🎉

## Getting Started

### Prerequisites

- Node.js 20+ or Bun

### Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/vision.git
cd vision
```

2. Install dependencies:
```bash
bun install
```

3. Run the example:
```bash
bun example:hono
```

4. Open the dashboard at `http://localhost:9500`

## Project Structure

```
vision/
├── packages/
│   ├── core/              # Core WebSocket server & tracing
│   ├── adapter-hono/      # Hono.js adapter
│   └── ui/                # Dashboard UI (coming soon)
├── examples/
│   └── hono/              # Example Hono app
└── apps/
    └── web/               # Dashboard web app
```

## Development Workflow

### Working on Core

```bash
cd packages/core
pnpm dev  # Watch mode
```

### Working on Adapters

```bash
cd packages/adapter-hono
pnpm dev  # Watch mode
```

### Testing Changes

Use the example app to test your changes:

```bash
pnpm example:hono
```

## Creating a New Adapter

1. Create a new package:
```bash
mkdir -p packages/adapter-yourframework
```

2. Add `package.json`:
```json
{
  "name": "@getvision/adapter-yourframework",
  "version": "0.0.1",
  "type": "module",
  "dependencies": {
    "@getvision/core": "workspace:*"
  },
  "peerDependencies": {
    "yourframework": "^1.0.0"
  }
}
```

3. Implement the adapter following the Hono adapter pattern

4. Add an example in `examples/yourframework`

## Coding Guidelines

- **TypeScript** - All code must be TypeScript
- **ESM** - Use ES modules (`import`/`export`)
- **Type-safe** - Export all types from `types/index.ts`
- **Comments** - Add JSDoc comments for public APIs
- **Formatting** - Run `bun format` before committing

## Commit Convention

We use conventional commits:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `chore:` - Maintenance tasks
- `refactor:` - Code refactoring
- `test:` - Adding tests

Example:
```
feat(adapter-hono): add query parameter tracking
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes
4. Run linting: `bun lint`
5. Commit with conventional commits
6. Push and create a PR

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions
- Join our Discord (coming soon)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
