import JSON5 from 'json5'

export function parseJson5(input: string): unknown {
  return JSON5.parse(input)
}
