/**
 * Pins the public API contract for trace exporters in `@getvision/server`:
 *
 *   1. `OtlpTraceExporter` is reachable as a value from the package entry and
 *      satisfies the `TraceExporter` contract.
 *   2. `VisionConfig.vision.exporters` accepts a `TraceExporter[]` (the field
 *      that `buildVisionCore` forwards into `VisionCore`).
 *
 * The runtime fan-out (a completed trace reaching each exporter) is covered by
 * the unit tests in `@getvision/core`.
 */

import { describe, expect, test } from 'bun:test'
import type { Trace, TraceExporter } from '@getvision/core'

import { OtlpTraceExporter, type VisionConfig } from '../index'

describe('exporter wiring', () => {
  test('OtlpTraceExporter is exported and implements TraceExporter', () => {
    const exporter: TraceExporter = new OtlpTraceExporter({
      endpoint: 'http://localhost/v1/traces',
      serviceName: 'test',
    })
    expect(typeof exporter.export).toBe('function')
    expect(typeof exporter.shutdown).toBe('function')
  })

  test('VisionConfig.vision.exporters accepts a TraceExporter[]', () => {
    const capturing: TraceExporter = {
      export(_trace: Trace) {},
    }
    const config = {
      service: { name: 'cfg' },
      vision: { enabled: false, exporters: [capturing] },
    } satisfies VisionConfig

    expect(config.vision.exporters).toHaveLength(1)
  })
})
