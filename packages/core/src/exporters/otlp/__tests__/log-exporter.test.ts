import { describe, test, expect, afterEach } from 'bun:test'
import type { LogEntry } from '../../../types'
import { OtlpLogExporter } from '../log-exporter'

type FetchCall = { url: string; init: RequestInit }

function makeLog(id: string, messageChars: number): LogEntry {
  return {
    id,
    timestamp: 1_700_000_000_000,
    level: 'info',
    message: `${id}:${'x'.repeat(messageChars)}`,
  }
}

function sentIds(call: FetchCall): string[] {
  const payload = JSON.parse(String(call.init.body))
  return payload.resourceLogs[0].scopeLogs[0].logRecords.map(
    (r: { body: { stringValue: string } }) => r.body.stringValue.split(':')[0]
  )
}

const originalFetch = globalThis.fetch
let calls: FetchCall[] = []

function stubFetch(handler: (call: FetchCall) => Response): void {
  calls = []
  globalThis.fetch = (async (input: any, init: any) => {
    const call = { url: String(input), init: init ?? {} }
    calls.push(call)
    return handler(call)
  }) as typeof fetch
}

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('OtlpLogExporter — payload size limits', () => {
  test('splits a batch larger than maxPayloadBytes across several requests', async () => {
    stubFetch(() => new Response('', { status: 200 }))
    const exporter = new OtlpLogExporter({
      endpoint: 'http://test/v1/logs',
      maxExportBatchSize: 99,
      maxPayloadBytes: 1_500,
      onError: () => {},
    })

    const ids = ['a', 'b', 'c', 'd', 'e', 'f']
    for (const id of ids) exporter.export(makeLog(id, 400))
    await exporter.flush()

    expect(calls.length).toBeGreaterThan(1)
    for (const call of calls) {
      expect(new TextEncoder().encode(String(call.init.body)).byteLength).toBeLessThanOrEqual(1_500)
    }
    expect(calls.flatMap(sentIds)).toEqual(ids)
  })

  test('413 on a single entry drops it with a descriptive onError and no retry', async () => {
    stubFetch(() => new Response('', { status: 413, statusText: 'Request Entity Too Large' }))
    const errors: unknown[] = []
    const exporter = new OtlpLogExporter({
      endpoint: 'http://test/v1/logs',
      maxExportBatchSize: 99,
      onError: (e) => errors.push(e),
    })

    exporter.export(makeLog('huge', 1))
    await exporter.flush()
    await exporter.shutdown()

    expect(calls).toHaveLength(1)
    expect(errors).toHaveLength(1)
    expect(String(errors[0])).toContain('rejected log huge')
  })
})
