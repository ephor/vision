/**
 * Minimal TypeScript shapes for the OTLP/JSON trace wire format.
 *
 * Notes on the JSON encoding (differs from the protobuf JSON mapping):
 * - `traceId` / `spanId` are lowercase hex strings, NOT base64.
 * - `*UnixNano` fields are int64 encoded as decimal strings.
 *
 * @see https://opentelemetry.io/docs/specs/otlp/#otlphttp
 */

export interface OtlpAnyValue {
  stringValue?: string
  boolValue?: boolean
  intValue?: string
  doubleValue?: number
  arrayValue?: { values: OtlpAnyValue[] }
  kvlistValue?: { values: OtlpKeyValue[] }
}

export interface OtlpKeyValue {
  key: string
  value: OtlpAnyValue
}

export interface OtlpEvent {
  timeUnixNano: string
  name: string
  attributes?: OtlpKeyValue[]
}

/** STATUS_CODE_UNSET = 0, OK = 1, ERROR = 2 */
export interface OtlpStatus {
  code: 0 | 1 | 2
  message?: string
}

/** SpanKind enum values per the OTLP spec. */
export const SpanKind = {
  INTERNAL: 1,
  SERVER: 2,
  CLIENT: 3,
} as const

export interface OtlpSpan {
  traceId: string
  spanId: string
  parentSpanId?: string
  name: string
  kind: number
  startTimeUnixNano: string
  endTimeUnixNano: string
  attributes?: OtlpKeyValue[]
  events?: OtlpEvent[]
  status?: OtlpStatus
}

export interface OtlpScopeSpans {
  scope?: { name: string; version?: string }
  spans: OtlpSpan[]
}

export interface OtlpResourceSpans {
  resource?: { attributes: OtlpKeyValue[] }
  scopeSpans: OtlpScopeSpans[]
}

export interface OtlpTracePayload {
  resourceSpans: OtlpResourceSpans[]
}
