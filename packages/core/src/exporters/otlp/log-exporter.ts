import type { LogEntry, LogLevel } from '../../types'
import type { LogExporter } from '../types'
import { toAttributes, msToUnixNano } from './convert'
import type { OtlpKeyValue, OtlpLogRecord } from './otlp-types'
import { SeverityNumber } from './otlp-types'

export interface OtlpLogExporterOptions {
  /** OTLP/HTTP logs endpoint, e.g. `https://<host>/v1/logs`. */
  endpoint: string
  /** Extra headers, typically auth (e.g. `{ Authorization: 'Bearer <token>' }`). */
  headers?: Record<string, string>
  /** `service.name` resource attribute. Defaults to `'unknown_service'`. */
  serviceName?: string
  /** Additional resource attributes (e.g. `deployment.environment`). */
  resourceAttributes?: Record<string, unknown>
  /**
   * Hard cap on buffered log entries. Once reached, new entries are dropped and
   * reported via `onError`. Default 2048.
   */
  maxQueueSize?: number
  /**
   * Flush eagerly once this many entries are buffered. Default 512.
   */
  maxExportBatchSize?: number
  /** Background flush interval in ms. Default 5000. */
  flushIntervalMs?: number
  /** Per-request timeout in ms. Default 10000. */
  timeoutMs?: number
  /**
   * Notified on transport/HTTP failures and queue overflow. Defaults to
   * `console.warn` so problems aren't silently dropped during local dev.
   */
  onError?: (error: unknown) => void
}

const SCOPE = { name: '@getvision/core' }

function levelToSeverityNumber(level: LogLevel): number {
  switch (level) {
    case 'error':
      return SeverityNumber.ERROR
    case 'warn':
      return SeverityNumber.WARN
    case 'info':
      return SeverityNumber.INFO
    case 'debug':
      return SeverityNumber.DEBUG
    default:
      return SeverityNumber.INFO
  }
}

function logEntryToOtlpRecord(entry: LogEntry): OtlpLogRecord {
  const attributes: OtlpKeyValue[] = []
  if (entry.context && Object.keys(entry.context).length > 0) {
    attributes.push(...toAttributes(entry.context as Record<string, unknown>))
  }
  if (entry.source) {
    attributes.push({ key: 'source', value: { stringValue: entry.source } })
  }
  if (entry.stack) {
    attributes.push({ key: 'stack', value: { stringValue: entry.stack } })
  }

  const record: OtlpLogRecord = {
    timeUnixNano: msToUnixNano(entry.timestamp),
    severityNumber: levelToSeverityNumber(entry.level),
    severityText: entry.level,
    body: { stringValue: entry.message },
    attributes: attributes.length > 0 ? attributes : undefined,
  }

  if (entry.traceId) {
    record.traceId = traceIdToHex(entry.traceId)
  }

  return record
}

function traceIdToHex(traceId: string): string {
  const bytes = new TextEncoder().encode(traceId)
  let hex = ''
  for (let i = 0; i < Math.min(bytes.length, 16); i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex.padEnd(32, '0')
}

/**
 * Buffers log entries and ships them to any OTLP/HTTP-compatible backend
 * (BetterStack, Honeycomb, Grafana, an OTel Collector, …) as OTLP/JSON.
 *
 * Failed batches are re-buffered for the next flush so a transient backend
 * outage doesn't silently lose logs; `maxQueueSize` bounds memory growth if
 * the backend stays down.
 */
export class OtlpLogExporter implements LogExporter {
  private readonly endpoint: string
  private readonly headers: Record<string, string>
  private readonly resource: OtlpKeyValue[]
  private readonly maxQueueSize: number
  private readonly maxExportBatchSize: number
  private readonly timeoutMs: number
  private readonly onError: (error: unknown) => void
  private queue: LogEntry[] = []
  private timer?: ReturnType<typeof setInterval>
  private flushing?: Promise<void>

  constructor(options: OtlpLogExporterOptions) {
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
    this.timer.unref?.()
  }

  export(entry: LogEntry): void {
    if (this.queue.length >= this.maxQueueSize) {
      this.onError(
        new Error(
          `OTLP log exporter queue full (${this.maxQueueSize}); dropping log ${entry.id}`
        )
      )
      return
    }
    this.queue.push(entry)
    if (this.queue.length >= this.maxExportBatchSize) void this.flush()
  }

  async flush(): Promise<void> {
    if (this.flushing) return this.flushing
    if (this.queue.length === 0) return

    const batch = this.queue
    this.queue = []
    this.flushing = this.send(batch).finally(() => {
      this.flushing = undefined
    })
    return this.flushing
  }

  private async send(batch: LogEntry[]): Promise<void> {
    const payload = logsToOtlpPayload(batch, this.resource)
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeoutMs),
      })
      if (!response.ok) {
        this.onError(
          new Error(`OTLP log export failed: ${response.status} ${response.statusText}`)
        )
        this.rebuffer(batch)
      }
    } catch (error) {
      this.onError(error)
      this.rebuffer(batch)
    }
  }

  private rebuffer(batch: LogEntry[]): void {
    const room = this.maxQueueSize - this.queue.length
    if (room <= 0) {
      this.onError(
        new Error(
          `OTLP log exporter queue full (${this.maxQueueSize}); dropping ${batch.length} retried logs`
        )
      )
      return
    }
    if (batch.length > room) {
      const dropped = batch.length - room
      this.onError(
        new Error(
          `OTLP log exporter queue full (${this.maxQueueSize}); dropping ${dropped} of ${batch.length} retried logs`
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
    await this.flush()
  }
}

function logsToOtlpPayload(
  entries: LogEntry[],
  resourceAttributes: OtlpKeyValue[]
): { resourceLogs: Array<{ resource: { attributes: OtlpKeyValue[] }; scopeLogs: Array<{ scope: { name: string }; logRecords: OtlpLogRecord[] }> }> } {
  return {
    resourceLogs: [
      {
        resource: { attributes: resourceAttributes },
        scopeLogs: [{ scope: SCOPE, logRecords: entries.map(logEntryToOtlpRecord) }],
      },
    ],
  }
}

function mergeHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (!extra) return headers
  for (const [key, value] of Object.entries(extra)) {
    headers[key.toLowerCase()] = value
  }
  return headers
}

function defaultOnError(error: unknown): void {
  console.warn('[OtlpLogExporter]', error)
}
