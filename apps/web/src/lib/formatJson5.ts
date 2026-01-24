import type { Plugin } from 'prettier'
import prettier from 'prettier/standalone'
import parserBabel from 'prettier/plugins/babel'
import pluginEstree from 'prettier/plugins/estree'

export async function formatJson5(input: string): Promise<string> {
  const trimmed = input.trim()
  if (!trimmed) return input

  try {
    const formatted = await prettier.format(trimmed, {
      parser: 'json5',
      plugins: [parserBabel, pluginEstree as Plugin],
      tabWidth: 2,
      trailingComma: 'none',
    })
    return formatted.trim()
  } catch {
    return input
  }
}
