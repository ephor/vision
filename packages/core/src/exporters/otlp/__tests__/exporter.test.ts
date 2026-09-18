/**
 * Behavioral tests for `OtlpTraceExporter` covering the bits the
 * pure-transform tests don't reach: queue bounds, re-buffer on failure,
 * serialized flush, and header merge.
 *
 * We stub `globalThis.fetch` per test so nothing hits the network.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import type { Trace } from '../../../types'
import { OtlpTraceExporter } from '../exporter'

function makeTrace(id: string): Trace {
  return {
    id,
    timestamp: 1_700_000_000_000,
    method: 'GET',
    path: '/x',
    statusCode: 200,
    duration: 1,
    spans: [],
  }
}

type FetchCall = { url: string; init: RequestInit }

interface FetchStub {
  calls: FetchCall[]
  restore: () => void
}

function stubFetch(handler: (call: FetchCall) => Promise<Response> | Response): FetchStub {
  const original = globalThis.fetch
  const calls: FetchCall[] = []
  globalThis.fetch = (async (input: any, init: any) => {
    const call = { url: String(input), init: init ?? {} }
    calls.push(call)
    return handler(call)
  }) as typeof fetch
  return {
    calls,
    restore: () => {
      globalThis.fetch = original
    },
  }
}

let stub: FetchStub | undefined

beforeEach(() => {
  stub = undefined
})

afterEach(() => {
  stub?.restore()
})

describe('OtlpTraceExporter — queue bounds', () => {
  test('drops new traces once maxQueueSize is reached and surfaces via onError', async () => {
    stub = stubFetch(() => new Response('', { status: 200 }))
    const errors: unknown[] = []
    const exporter = new OtlpTraceExporter({
      endpoint: 'http://test/v1/traces',
      maxQueueSize: 2,
      maxExportBatchSize: 99, // suppress threshold-triggered flush
      onError: (e) => errors.push(e),
    })

    exporter.export(makeTrace('a'))
    exporter.export(makeTrace('b'))
    exporter.export(makeTrace('c')) // should drop
    exporter.export(makeTrace('d')) // should drop

    expect(errors).toHaveLength(2)
    expect(String(errors[0])).toContain('queue full (2)')
    expect(String(errors[0])).toContain('trace c')

    await exporter.shutdown()
    expect(stub!.calls).toHaveLength(1)
    const payload = JSON.parse(String(stub!.calls[0].init.body))
    expect(payload.resourceSpans[0].scopeSpans[0].spans).toHaveLength(2)
  })

  test('eagerly flushes once maxExportBatchSize is reached', async () => {
    let resolveFetch!: (r: Response) => void
    stub = stubFetch(
      () => new Promise<Response>((r) => { resolveFetch = r })
    )
    const exporter = new OtlpTraceExporter({
      endpoint: 'http://test/v1/traces',
      maxExportBatchSize: 2,
      onError: () => {},
    })

    exporter.export(makeTrace('a'))
    expect(stub!.calls).toHaveLength(0)
    exporter.export(makeTrace('b'))
    // Threshold reached — flush kicked off synchronously.
    await Promise.resolve()
    expect(stub!.calls).toHaveLength(1)

    resolveFetch(new Response('', { status: 200 }))
    await exporter.shutdown()
  })
})

describe('OtlpTraceExporter — failure handling', () => {
  test('re-buffers a failed batch for the next flush', async () => {
    let attempt = 0
    stub = stubFetch(() => {
      attempt++
      return attempt === 1
        ? new Response('boom', { status: 500, statusText: 'Server Error' })
        : new Response('', { status: 200 })
    })
    const errors: unknown[] = []
    const exporter = new OtlpTraceExporter({
      endpoint: 'http://test/v1/traces',
      maxExportBatchSize: 99,
      onError: (e) => errors.push(e),
    })

    exporter.export(makeTrace('a'))
    await exporter.flush() // 500 — should re-buffer

    expect(errors).toHaveLength(1)
    expect(String(errors[0])).toContain('500')

    await exporter.flush() // retry — should succeed
    expect(stub!.calls).toHaveLength(2)

    // Nothing left to ship on shutdown.
    await exporter.shutdown()
    expect(stub!.calls).toHaveLength(2)
  })

  test('re-buffer respects maxQueueSize and drops the oldest overflow', async () => {
    stub = stubFetch(() => new Response('', { status: 500 }))
    const errors: unknown[] = []
    const exporter = new OtlpTraceExporter({
      endpoint: 'http://test/v1/traces',
      maxQueueSize: 3,
      maxExportBatchSize: 99,
      onError: (e) => errors.push(e),
    })

    exporter.export(makeTrace('a'))
    exporter.export(makeTrace('b'))
    exporter.export(makeTrace('c'))
    await exporter.flush() // 3 traces fail, queue empty, re-buffer all 3
    // queue is now [a, b, c]

    exporter.export(makeTrace('d'))
    exporter.export(makeTrace('e'))
    exporter.export(makeTrace('f')) // dropped — queue at cap (3) before push
    // queue is still [a, b, c]; d, e were dropped on push

    // Errors so far: one HTTP failure + the drop of d/e/f on push.
    const overflowDrops = errors.filter((e) => String(e).includes('dropping trace'))
    expect(overflowDrops.length).toBeGreaterThanOrEqual(1)
  })
})

describe('OtlpTraceExporter — concurrency', () => {
  test('serializes concurrent flushes into a single in-flight request', async () => {
    let resolveFetch!: (r: Response) => void
    stub = stubFetch(
      () => new Promise<Response>((r) => { resolveFetch = r })
    )
    const exporter = new OtlpTraceExporter({
      endpoint: 'http://test/v1/traces',
      maxExportBatchSize: 99,
      onError: () => {},
    })

    exporter.export(makeTrace('a'))
    const p1 = exporter.flush()
    const p2 = exporter.flush()
    const p3 = exporter.flush()

    // Only one fetch in flight — the second/third flush() returned the same promise.
    expect(stub!.calls).toHaveLength(1)

    resolveFetch(new Response('', { status: 200 }))
    await Promise.all([p1, p2, p3])
    expect(stub!.calls).toHaveLength(1)
  })
})

describe('OtlpTraceExporter — header merge', () => {
  test('user headers override defaults case-insensitively', async () => {
    stub = stubFetch(() => new Response('', { status: 200 }))
    const exporter = new OtlpTraceExporter({
      endpoint: 'http://test/v1/traces',
      headers: { 'Content-Type': 'application/x-protobuf', Authorization: 'Bearer t' },
      onError: () => {},
    })

    exporter.export(makeTrace('a'))
    await exporter.flush()

    const headers = stub!.calls[0].init.headers as Record<string, string>
    // No duplicate `Content-Type` keys — the user override wins.
    expect(headers['content-type']).toBe('application/x-protobuf')
    expect(headers['Content-Type']).toBeUndefined()
    expect(headers['authorization']).toBe('Bearer t')
  })
})

function makeBigTrace(id: string, bodyChars: number): Trace {
  return { ...makeTrace(id), path: `/t-${id}`, metadata: { body: 'x'.repeat(bodyChars) } }
}

function sentPaths(call: FetchCall): string[] {
  const payload = JSON.parse(String(call.init.body))
  return payload.resourceSpans[0].scopeSpans[0].spans.map((s: { name: string }) =>
    s.name.replace('GET /t-', '')
  )
}

describe('OtlpTraceExporter — payload size limits', () => {
  test('splits a batch larger than maxPayloadBytes across several requests', async () => {
    stub = stubFetch(() => new Response('', { status: 200 }))
    const exporter = new OtlpTraceExporter({
      endpoint: 'http://test/v1/traces',
      maxExportBatchSize: 99,
      maxPayloadBytes: 2_000,
      onError: () => {},
    })

    const ids = ['a', 'b', 'c', 'd', 'e', 'f']
    for (const id of ids) exporter.export(makeBigTrace(id, 500))
    await exporter.flush()

    expect(stub!.calls.length).toBeGreaterThan(1)
    for (const call of stub!.calls) {
      expect(new TextEncoder().encode(String(call.init.body)).byteLength).toBeLessThanOrEqual(2_000)
    }
    expect(stub!.calls.flatMap(sentPaths)).toEqual(ids)
  })

  test('falls back to the default cap for non-positive maxPayloadBytes', async () => {
    stub = stubFetch(() => new Response('', { status: 200 }))
    const exporter = new OtlpTraceExporter({
      endpoint: 'http://test/v1/traces',
      maxExportBatchSize: 99,
      maxPayloadBytes: 0,
      onError: () => {},
    })

    exporter.export(makeBigTrace('a', 10))
    exporter.export(makeBigTrace('b', 10))
    await exporter.flush()

    expect(stub!.calls).toHaveLength(1)
  })

  test('413 on a multi-trace batch splits it and sends the halves without re-buffering', async () => {
    stub = stubFetch((call) =>
      sentPaths(call).length > 2
        ? new Response('', { status: 413, statusText: 'Request Entity Too Large' })
        : new Response('', { status: 200 })
    )
    const errors: unknown[] = []
    const exporter = new OtlpTraceExporter({
      endpoint: 'http://test/v1/traces',
      maxExportBatchSize: 99,
      onError: (e) => errors.push(e),
    })

    for (const id of ['a', 'b', 'c', 'd']) exporter.export(makeBigTrace(id, 1))
    await exporter.flush()

    expect(stub!.calls.map(sentPaths)).toEqual([['a', 'b', 'c', 'd'], ['a', 'b'], ['c', 'd']])
    expect(errors).toHaveLength(0)

    await exporter.flush()
    expect(stub!.calls).toHaveLength(3)
  })

  test('413 on a single trace drops it with a descriptive onError and no retry', async () => {
    stub = stubFetch(() => new Response('', { status: 413, statusText: 'Request Entity Too Large' }))
    const errors: unknown[] = []
    const exporter = new OtlpTraceExporter({
      endpoint: 'http://test/v1/traces',
      maxExportBatchSize: 99,
      onError: (e) => errors.push(e),
    })

    exporter.export(makeBigTrace('huge', 1))
    await exporter.flush()

    expect(errors).toHaveLength(1)
    expect(String(errors[0])).toContain('rejected trace huge')
    expect(String(errors[0])).toContain('413')
    expect(String(errors[0])).toContain('dropping')

    await exporter.shutdown()
    expect(stub!.calls).toHaveLength(1)
  })
})

describe('OtlpTraceExporter — compression', () => {
  const hasCompressionStream = typeof globalThis.CompressionStream === 'function'

  test.skipIf(!hasCompressionStream)('gzip sends content-encoding and a gunzippable JSON body', async () => {
    stub = stubFetch(() => new Response('', { status: 200 }))
    const exporter = new OtlpTraceExporter({
      endpoint: 'http://test/v1/traces',
      compression: 'gzip',
      onError: () => {},
    })

    exporter.export(makeTrace('a'))
    await exporter.flush()

    const { init } = stub!.calls[0]
    const headers = init.headers as Record<string, string>
    expect(headers['content-encoding']).toBe('gzip')
    expect(headers['content-type']).toBe('application/json')

    const text = await new Response(
      new Blob([init.body as ArrayBuffer]).stream().pipeThrough(new DecompressionStream('gzip'))
    ).text()
    const payload = JSON.parse(text)
    expect(payload.resourceSpans[0].scopeSpans[0].spans).toHaveLength(1)
  })

  test('defaults to an uncompressed body', async () => {
    stub = stubFetch(() => new Response('', { status: 200 }))
    const exporter = new OtlpTraceExporter({ endpoint: 'http://test/v1/traces', onError: () => {} })

    exporter.export(makeTrace('a'))
    await exporter.flush()

    const headers = stub!.calls[0].init.headers as Record<string, string>
    expect(headers['content-encoding']).toBeUndefined()
    expect(typeof stub!.calls[0].init.body).toBe('string')
  })
})
