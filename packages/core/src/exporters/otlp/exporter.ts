import type { Trace } from '../../types'
import type { TraceExporter } from '../types'
import { toAttributes } from './convert'
import { tracesToOtlpPayload } from './transform'
import type { OtlpKeyValue } from './otlp-types'

export interface OtlpExporterOptions {
  /** OTLP/HTTP traces endpoint, e.g. `https://<host>/v1/traces`. */
  endpoint: string
  /** Extra headers, typically auth (e.g. `{ Authorization: 'Bearer <token>' }`). */
  headers?: Record<string, string>
  /** `service.name` resource attribute. Defaults to `'unknown_service'`. */
  serviceName?: string
  /** Additional resource attributes (e.g. `deployment.environment`). */
  resourceAttributes?: Record<string, unknown>
  /** Flush when this many traces are buffered. Default 100. */
  maxQueueSize?: number
  /** Background flush interval in ms. Default 5000. */
  flushIntervalMs?: number
  /** Per-request timeout in ms. Default 10000. */
  timeoutMs?: number
  /** Notified on transport/HTTP failures. Defaults to a no-op (silent). */
  onError?: (error: unknown) => void
}

/**
 * Buffers completed traces and ships them to any OTLP/HTTP-compatible backend
 * (BetterStack, Honeycomb, Grafana, an OTel Collector, …) as OTLP/JSON. The
 * destination is purely a matter of `endpoint` + `headers`.
 */
export class OtlpTraceExporter implements TraceExporter {
  private readonly endpoint: string
  private readonly headers: Record<string, string>
  private readonly resource: OtlpKeyValue[]
  private readonly maxQueueSize: number
  private readonly timeoutMs: number
  private readonly onError: (error: unknown) => void
  private queue: Trace[] = []
  private timer?: ReturnType<typeof setInterval>

  constructor(options: OtlpExporterOptions) {
    this.endpoint = options.endpoint
    this.headers = { 'content-type': 'application/json', ...options.headers }
    this.resource = toAttributes({
      'service.name': options.serviceName ?? 'unknown_service',
      ...options.resourceAttributes,
    })
    this.maxQueueSize = options.maxQueueSize ?? 100
    this.timeoutMs = options.timeoutMs ?? 10_000
    this.onError = options.onError ?? (() => {})

    this.timer = setInterval(() => void this.flush(), options.flushIntervalMs ?? 5_000)
    // Don't keep the process alive just for the flush timer.
    this.timer.unref?.()
  }

  export(trace: Trace): void {
    this.queue.push(trace)
    if (this.queue.length >= this.maxQueueSize) void this.flush()
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return

    const batch = this.queue
    this.queue = []
    const payload = tracesToOtlpPayload(batch, this.resource)

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeoutMs),
      })
      if (!response.ok) {
        this.onError(
          new Error(`OTLP export failed: ${response.status} ${response.statusText}`)
        )
      }
    } catch (error) {
      this.onError(error)
    }
  }

  async shutdown(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = undefined
    }
    await this.flush()
  }
}
