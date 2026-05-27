import { describe, test, expect } from 'bun:test'
import type { Trace } from '../../../types'
import { traceToOtlpSpans, tracesToOtlpPayload } from '../transform'
import { newSpanId, newTraceId } from '../ids'
import { msToUnixNano, toAnyValue } from '../convert'

function makeTrace(overrides: Partial<Trace> = {}): Trace {
  return {
    id: 'trace-1',
    timestamp: 1_700_000_000_000,
    method: 'GET',
    path: '/users',
    statusCode: 200,
    duration: 50,
    spans: [],
    ...overrides,
  }
}

describe('id generation', () => {
  test('trace id is 32 hex chars, span id is 16', () => {
    expect(newTraceId()).toMatch(/^[0-9a-f]{32}$/)
    expect(newSpanId()).toMatch(/^[0-9a-f]{16}$/)
  })

  test('ids are random (two calls differ)', () => {
    expect(newTraceId()).not.toBe(newTraceId())
    expect(newSpanId()).not.toBe(newSpanId())
  })
})

describe('value conversion', () => {
  test('msToUnixNano keeps int64 precision as a string', () => {
    expect(msToUnixNano(1_700_000_000_000)).toBe('1700000000000000000')
  })

  test('toAnyValue maps JS primitives to OTLP AnyValue', () => {
    expect(toAnyValue('x')).toEqual({ stringValue: 'x' })
    expect(toAnyValue(true)).toEqual({ boolValue: true })
    expect(toAnyValue(42)).toEqual({ intValue: '42' })
    expect(toAnyValue(1.5)).toEqual({ doubleValue: 1.5 })
    expect(toAnyValue(null)).toBeUndefined()
    expect(toAnyValue(undefined)).toBeUndefined()
  })
})

describe('traceToOtlpSpans', () => {
  test('synthesizes a SERVER root span from the trace', () => {
    const [root] = traceToOtlpSpans(makeTrace())
    expect(root.kind).toBe(2)
    expect(root.name).toBe('GET /users')
    expect(root.traceId).toMatch(/^[0-9a-f]{32}$/)
    expect(root.spanId).toMatch(/^[0-9a-f]{16}$/)
    expect(root.endTimeUnixNano).toBe(msToUnixNano(1_700_000_000_050))
    expect(root.attributes).toContainEqual({
      key: 'http.request.method',
      value: { stringValue: 'GET' },
    })
    expect(root.attributes).toContainEqual({
      key: 'http.response.status_code',
      value: { intValue: '200' },
    })
  })

  test('child spans without parentId reparent onto the synthetic root', () => {
    const trace = makeTrace({
      spans: [
        {
          id: 'span-1',
          traceId: 'trace-1',
          name: 'db.query',
          startTime: 1_700_000_000_010,
          endTime: 1_700_000_000_030,
          duration: 20,
        },
      ],
    })
    const [root, child] = traceToOtlpSpans(trace)
    expect(child.kind).toBe(1)
    expect(child.traceId).toBe(root.traceId)
    expect(child.parentSpanId).toBe(root.spanId)
  })

  test('explicit parentId resolves to the parent span id', () => {
    const trace = makeTrace({
      spans: [
        {
          id: 'span-1',
          traceId: 'trace-1',
          name: 'parent',
          startTime: 1_700_000_000_010,
          endTime: 1_700_000_000_025,
        },
        {
          id: 'span-2',
          traceId: 'trace-1',
          parentId: 'span-1',
          name: 'nested',
          startTime: 1_700_000_000_015,
          endTime: 1_700_000_000_020,
        },
      ],
    })
    const [, parent, child] = traceToOtlpSpans(trace)
    expect(child.parentSpanId).toBe(parent.spanId)
  })

  test('5xx status marks the root span as error, 4xx does not', () => {
    expect(traceToOtlpSpans(makeTrace({ statusCode: 503 }))[0].status).toEqual({ code: 2 })
    expect(traceToOtlpSpans(makeTrace({ statusCode: 404 }))[0].status).toBeUndefined()
  })

  test('error attribute on a child span produces an error status', () => {
    const trace = makeTrace({
      spans: [
        {
          id: 'span-1',
          traceId: 'trace-1',
          name: 'boom',
          startTime: 1_700_000_000_010,
          endTime: 1_700_000_000_011,
          attributes: { error: true, 'error.message': 'kaboom' },
        },
      ],
    })
    const [, child] = traceToOtlpSpans(trace)
    expect(child.status).toEqual({ code: 2, message: 'kaboom' })
  })

  test('trace logs become events on the root span', () => {
    const trace = makeTrace({
      logs: [
        {
          id: 'log-1',
          timestamp: 1_700_000_000_005,
          level: 'error',
          message: 'something happened',
        },
      ],
    })
    const [root] = traceToOtlpSpans(trace)
    expect(root.events?.[0]).toMatchObject({
      name: 'log',
      timeUnixNano: msToUnixNano(1_700_000_000_005),
    })
  })
})

describe('tracesToOtlpPayload', () => {
  test('wraps spans under one resource/scope with the given resource attributes', () => {
    const resource = [{ key: 'service.name', value: { stringValue: 'api' } }]
    const payload = tracesToOtlpPayload([makeTrace(), makeTrace({ id: 'trace-2' })], resource)

    expect(payload.resourceSpans).toHaveLength(1)
    expect(payload.resourceSpans[0].resource?.attributes).toEqual(resource)
    expect(payload.resourceSpans[0].scopeSpans[0].scope?.name).toBe('@getvision/core')
    // 2 traces × 1 synthetic root span each.
    expect(payload.resourceSpans[0].scopeSpans[0].spans).toHaveLength(2)
  })
})
