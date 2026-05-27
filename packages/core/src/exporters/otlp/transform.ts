import type { LogEntry, Span, SpanEvent, Trace } from '../../types'
import { msToUnixNano, toAttributes } from './convert'
import { newSpanId, newTraceId } from './ids'
import {
  SpanKind,
  type OtlpEvent,
  type OtlpKeyValue,
  type OtlpSpan,
  type OtlpStatus,
  type OtlpTracePayload,
} from './otlp-types'

const SCOPE = { name: '@getvision/core' }

/** HTTP server-span status: only 5xx counts as an error (4xx is a client problem). */
function httpStatus(statusCode?: number): OtlpStatus | undefined {
  if (statusCode !== undefined && statusCode >= 500) return { code: 2 }
  return undefined
}

/** Child-span status derived from the `error` attribute set by `createSpanHelper`. */
function spanStatus(span: Span): OtlpStatus | undefined {
  if (span.attributes?.error === true) {
    const message = span.attributes['error.message']
    return { code: 2, message: message !== undefined ? String(message) : undefined }
  }
  return undefined
}

function spanEventToOtlp(event: SpanEvent): OtlpEvent {
  return {
    timeUnixNano: msToUnixNano(event.timestamp),
    name: event.name,
    attributes: event.attributes ? toAttributes(event.attributes) : undefined,
  }
}

function logToOtlpEvent(log: LogEntry): OtlpEvent {
  return {
    timeUnixNano: msToUnixNano(log.timestamp),
    name: 'log',
    attributes: toAttributes({
      'log.severity': log.level,
      'log.message': log.message,
      ...log.context,
    }),
  }
}

function rootSpan(trace: Trace, traceId: string, rootSpanId: string): OtlpSpan {
  const attributes: OtlpKeyValue[] = [
    { key: 'http.request.method', value: { stringValue: trace.method } },
    { key: 'url.path', value: { stringValue: trace.path } },
  ]
  if (trace.statusCode !== undefined) {
    attributes.push({
      key: 'http.response.status_code',
      value: { intValue: String(trace.statusCode) },
    })
  }
  if (trace.metadata) attributes.push(...toAttributes(trace.metadata))

  return {
    traceId,
    spanId: rootSpanId,
    name: `${trace.method} ${trace.path}`,
    kind: SpanKind.SERVER,
    startTimeUnixNano: msToUnixNano(trace.timestamp),
    endTimeUnixNano: msToUnixNano(trace.timestamp + (trace.duration ?? 0)),
    attributes,
    events: trace.logs?.map(logToOtlpEvent),
    status: httpStatus(trace.statusCode),
  }
}

function childSpan(
  span: Span,
  traceId: string,
  rootSpanId: string,
  spanIds: Map<string, string>
): OtlpSpan {
  const parentSpanId = span.parentId ? spanIds.get(span.parentId) ?? rootSpanId : rootSpanId
  return {
    traceId,
    spanId: spanIds.get(span.id) ?? newSpanId(),
    parentSpanId,
    name: span.name,
    kind: SpanKind.INTERNAL,
    startTimeUnixNano: msToUnixNano(span.startTime),
    endTimeUnixNano: msToUnixNano(span.endTime ?? span.startTime + (span.duration ?? 0)),
    attributes: span.attributes ? toAttributes(span.attributes) : undefined,
    events: span.events?.map(spanEventToOtlp),
    status: spanStatus(span),
  }
}

/** Map a single Vision trace to its OTLP spans (one synthetic root + children). */
export function traceToOtlpSpans(trace: Trace): OtlpSpan[] {
  const traceId = newTraceId()
  const rootSpanId = newSpanId()
  // Assign each child a stable id up front so parentId references resolve.
  const spanIds = new Map<string, string>()
  for (const span of trace.spans) spanIds.set(span.id, newSpanId())

  return [
    rootSpan(trace, traceId, rootSpanId),
    ...trace.spans.map((span) => childSpan(span, traceId, rootSpanId, spanIds)),
  ]
}

/** Build a complete OTLP/JSON trace payload for a batch of traces under one resource. */
export function tracesToOtlpPayload(
  traces: Trace[],
  resourceAttributes: OtlpKeyValue[]
): OtlpTracePayload {
  return {
    resourceSpans: [
      {
        resource: { attributes: resourceAttributes },
        scopeSpans: [{ scope: SCOPE, spans: traces.flatMap(traceToOtlpSpans) }],
      },
    ],
  }
}
