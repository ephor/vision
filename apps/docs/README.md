# Vision Documentation

Documentation site for Vision - Universal observability for modern apps.

Built with [Fumadocs](https://fumadocs.dev) and Next.js.

## Development

```bash
bun install
bun dev
```

Open http://localhost:3000

## Structure

```
apps/docs/
├── app/
│   ├── (home)/          # Landing page
│   ├── docs/            # Documentation layout
│   └── api/search/      # Search API
├── content/docs/        # MDX documentation files
│   ├── index.mdx        # Introduction
│   ├── quickstart.mdx
│   ├── concepts.mdx
│   ├── adapters/        # Framework adapters
│   ├── features/        # Feature guides
│   ├── deployment.mdx
│   └── api-reference.mdx
├── lib/
│   ├── source.ts        # Content source adapter
│   └── layout.shared.tsx # Shared layout config
└── source.config.ts     # Fumadocs MDX config
```

## Adding Documentation

1. Create `.mdx` file in `content/docs/`
2. Add frontmatter:
   ```yaml
   ---
   title: Page Title
   description: Page description
   ---
   ```
3. Update `meta.json` in the folder to add to navigation
4. Run `bun run postinstall` to regenerate types

## Building

```bash
bun build
```

Static site will be generated in `out/` directory.

## Deployment

Deploy to Cloudflare Pages:

```bash
bun build
# Upload out/ directory to Cloudflare Pages
```

Or use automatic GitHub integration.
