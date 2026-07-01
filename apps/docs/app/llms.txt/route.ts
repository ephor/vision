import { source } from '@/lib/source';

export const revalidate = false;

/**
 * Short LLM-friendly index of the documentation, per the llms.txt spec
 * (https://llmstxt.org/). Each page is listed as a markdown link with its
 * frontmatter description. The full text of every page lives at
 * `/llms-full.txt`.
 */
export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://getvision.dev';

  const pages = source.getPages();
  const lines: string[] = [
    '# Vision',
    '',
    '> Universal observability dashboard for API development — built-in tracing,',
    "> logs, and an API explorer for Express, Fastify, Hono, Next.js, or Vision's",
    '> own Elysia-based meta-framework.',
    '',
    '## Docs',
    '',
  ];

  for (const page of pages) {
    const title = page.data.title;
    const description = page.data.description;
    const url = `${baseUrl}${page.url}`;
    lines.push(
      description
        ? `- [${title}](${url}): ${description}`
        : `- [${title}](${url})`
    );
  }

  lines.push('', '## Full content', '', `- [Full documentation](${baseUrl}/llms-full.txt)`);

  return new Response(lines.join('\n'), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
