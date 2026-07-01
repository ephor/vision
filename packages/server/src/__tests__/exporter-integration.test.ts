/**
 * Pins the public API contract for exporters in `@getvision/server`:
 *
 *   1. `OtlpTraceExporter` is reachable and satisfies `TraceExporter`.
 *   2. `OtlpLogExporter` is reachable and satisfies `LogExporter`.
 *   3. `VisionConfig.vision.exporters` accepts `{ traces?, logs? }`.
 *
 * The runtime fan-out (traces/logs reaching each exporter) is covered by the
 * unit tests in `@getvision/core`.
 */

import { describe, expect, test } from 'bun:test'
import type { Trace, TraceExporter, LogEntry, LogExporter } from '@getvision/core'

import { OtlpTraceExporter, OtlpLogExporter, type VisionConfig } from '../index'

describe('exporter wiring', () => {
  test('OtlpTraceExporter is exported and implements TraceExporter', () => {
    const exporter: TraceExporter = new OtlpTraceExporter({
      endpoint: 'http://localhost/v1/traces',
      serviceName: 'test',
    })
    expect(typeof exporter.export).toBe('function')
    expect(typeof exporter.shutdown).toBe('function')
  })

  test('OtlpLogExporter is exported and implements LogExporter', () => {
    const exporter: LogExporter = new OtlpLogExporter({
      endpoint: 'http://localhost/v1/logs',
      serviceName: 'test',
    })
    expect(typeof exporter.export).toBe('function')
    expect(typeof exporter.shutdown).toBe('function')
  })

  test('VisionConfig.vision.exporters.traces accepts a TraceExporter[]', () => {
    const capturing: TraceExporter = {
      export(_trace: Trace) {},
    }
    const config = {
      service: { name: 'cfg' },
      vision: { enabled: false, exporters: { traces: [capturing] } },
    } satisfies VisionConfig

    expect(config.vision.exporters?.traces).toHaveLength(1)
  })

  test('VisionConfig.vision.exporters.logs accepts a LogExporter[]', () => {
    const capturing: LogExporter = {
      export(_entry: LogEntry) {},
    }
    const config = {
      service: { name: 'cfg' },
      vision: { enabled: false, exporters: { logs: [capturing] } },
    } satisfies VisionConfig

    expect(config.vision.exporters?.logs).toHaveLength(1)
  })
})
