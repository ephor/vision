import type { OtlpAnyValue, OtlpKeyValue } from './otlp-types'

/** Milliseconds (epoch) → int64 nanoseconds as a decimal string (no float precision loss). */
export function msToUnixNano(ms: number): string {
  return (BigInt(Math.round(ms)) * 1_000_000n).toString()
}

/** Convert an arbitrary JS value into an OTLP AnyValue, or `undefined` to drop it. */
export function toAnyValue(value: unknown): OtlpAnyValue | undefined {
  if (value === null || value === undefined) return undefined

  switch (typeof value) {
    case 'string':
      return { stringValue: value }
    case 'boolean':
      return { boolValue: value }
    case 'number':
      return Number.isInteger(value)
        ? { intValue: String(value) }
        : { doubleValue: value }
    case 'bigint':
      return { intValue: value.toString() }
    case 'object': {
      if (Array.isArray(value)) {
        const values = value
          .map(toAnyValue)
          .filter((v): v is OtlpAnyValue => v !== undefined)
        return { arrayValue: { values } }
      }
      return { kvlistValue: { values: toAttributes(value as Record<string, unknown>) } }
    }
    default:
      return { stringValue: String(value) }
  }
}

/** Convert a flat record into OTLP key/value attributes, dropping nullish entries. */
export function toAttributes(record: Record<string, unknown>): OtlpKeyValue[] {
  const attributes: OtlpKeyValue[] = []
  for (const [key, raw] of Object.entries(record)) {
    const value = toAnyValue(raw)
    if (value !== undefined) attributes.push({ key, value })
  }
  return attributes
}
