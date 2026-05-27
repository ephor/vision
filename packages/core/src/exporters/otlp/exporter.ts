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
  /**
   * Hard cap on buffered traces. Once reached, new traces are dropped and
   * reported via `onError`. Default 2048 (matches the OTel SDK convention).
   */
  maxQueueSize?: number
  /**
   * Flush eagerly once this many traces are buffered, rather than waiting for
   * `flushIntervalMs`. Default 512.
   */
  maxExportBatchSize?: number
  /** Background flush interval in ms. Default 5000. */
  flushIntervalMs?: number
  /** Per-request timeout in ms. Default 10000. */
  timeoutMs?: number
  /**
   * Notified on transport/HTTP failures and queue overflow. Defaults to
   * `console.warn` so problems aren't silently dropped during local dev — pass
   * a no-op to silence.
   */
  onError?: (error: unknown) => void
}

/**
 * Buffers completed traces and ships them to any OTLP/HTTP-compatible backend
 * (BetterStack, Honeycomb, Grafana, an OTel Collector, …) as OTLP/JSON. The
 * destination is purely a matter of `endpoint` + `headers`.
 *
 * Failed batches are re-buffered for the next flush so a transient backend
 * outage doesn't silently lose traces; `maxQueueSize` bounds memory growth if
 * the backend stays down.
 */
export class OtlpTraceExporter implements TraceExporter {
  private readonly endpoint: string
  private readonly headers: Record<string, string>
  private readonly resource: OtlpKeyValue[]
  private readonly maxQueueSize: number
  private readonly maxExportBatchSize: number
  private readonly timeoutMs: number
  private readonly onError: (error: unknown) => void
  private queue: Trace[] = []
  private timer?: ReturnType<typeof setInterval>
  private flushing?: Promise<void>

  constructor(options: OtlpExporterOptions) {
    this.endpoint = options.endpoint
    this.headers = mergeHeaders(options.headers)
    this.resource = toAttributes({
      'service.name': options.serviceName ?? 'unknown_service',
      ...options.resourceAttributes,
    })
    this.maxQueueSize = options.maxQueueSize ?? 2048
    this.maxExportBatchSize = options.maxExportBatchSize ?? 512
    this.timeoutMs = options.timeoutMs ?? 10_000
    this.onError = options.onError ?? defaultOnError

    this.timer = setInterval(() => void this.flush(), options.flushIntervalMs ?? 5_000)
    // Don't keep the process alive just for the flush timer.
    this.timer.unref?.()
  }

  export(trace: Trace): void {
    if (this.queue.length >= this.maxQueueSize) {
      this.onError(
        new Error(
          `OTLP exporter queue full (${this.maxQueueSize}); dropping trace ${trace.id}`
        )
      )
      return
    }
    this.queue.push(trace)
    if (this.queue.length >= this.maxExportBatchSize) void this.flush()
  }

  async flush(): Promise<void> {
    // Serialize concurrent flushes — both the interval and the threshold
    // trigger can race, and stacking N in-flight POSTs against the same
    // endpoint is wasteful (and amplifies the blast radius on a slow backend).
    if (this.flushing) return this.flushing
    if (this.queue.length === 0) return

    const batch = this.queue
    this.queue = []
    this.flushing = this.send(batch).finally(() => {
      this.flushing = undefined
    })
    return this.flushing
  }

  private async send(batch: Trace[]): Promise<void> {
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
        this.rebuffer(batch)
      }
    } catch (error) {
      this.onError(error)
      this.rebuffer(batch)
    }
  }

  /**
   * Return a failed batch to the front of the queue so the next flush retries
   * it. Respects `maxQueueSize` so a persistently-down backend can't grow
   * memory without bound; on overflow we keep the newest entries (older traces
   * are less actionable once they're already stale).
   */
  private rebuffer(batch: Trace[]): void {
    const room = this.maxQueueSize - this.queue.length
    if (room <= 0) {
      this.onError(
        new Error(
          `OTLP exporter queue full (${this.maxQueueSize}); dropping ${batch.length} retried traces`
        )
      )
      return
    }
    if (batch.length > room) {
      const dropped = batch.length - room
      this.onError(
        new Error(
          `OTLP exporter queue full (${this.maxQueueSize}); dropping ${dropped} of ${batch.length} retried traces`
        )
      )
      this.queue.unshift(...batch.slice(dropped))
      return
    }
    this.queue.unshift(...batch)
  }

  async shutdown(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = undefined
    }
    // Single best-effort attempt — if the backend rejects the batch on the way
    // out, those traces are lost. Looping would risk spinning forever against a
    // persistently-failing endpoint at the worst possible time.
    await this.flush()
  }
}

function mergeHeaders(extra?: Record<string, string>): Record<string, string> {
  // Lowercase keys so a user-supplied `Content-Type` actually overrides our
  // default — without normalization the spread would produce both `content-type`
  // and `Content-Type` in the same object.
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (!extra) return headers
  for (const [key, value] of Object.entries(extra)) {
    headers[key.toLowerCase()] = value
  }
  return headers
}

function defaultOnError(error: unknown): void {
  console.warn('[OtlpTraceExporter]', error)
}
