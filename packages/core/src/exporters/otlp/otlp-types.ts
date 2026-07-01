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

// ---------------------------------------------------------------------------
// OTLP Logs types
// ---------------------------------------------------------------------------

/** @see https://opentelemetry.io/docs/specs/otel/logs/data-model/ */
export interface OtlpLogRecord {
  timeUnixNano: string
  observedTimeUnixNano?: string
  severityNumber?: number
  severityText?: string
  body?: { stringValue: string } | OtlpAnyValue
  attributes?: OtlpKeyValue[]
  traceId?: string
  spanId?: string
  flags?: number
}

export interface OtlpScopeLogs {
  scope?: { name: string; version?: string }
  logRecords: OtlpLogRecord[]
}

export interface OtlpResourceLogs {
  resource?: { attributes: OtlpKeyValue[] }
  scopeLogs: OtlpScopeLogs[]
}

export interface OtlpLogPayload {
  resourceLogs: OtlpResourceLogs[]
}

/** SeverityNumber values per the OTLP spec. */
export const SeverityNumber = {
  DEBUG: 5,
  INFO: 9,
  WARN: 13,
  ERROR: 17,
} as const
